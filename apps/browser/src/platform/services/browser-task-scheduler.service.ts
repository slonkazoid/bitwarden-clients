import { firstValueFrom, map, Observable } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { TaskIdentifier } from "@bitwarden/common/platform/abstractions/task-scheduler.service";
import { ScheduledTaskName } from "@bitwarden/common/platform/enums/scheduled-task-name.enum";
import { DefaultTaskSchedulerService } from "@bitwarden/common/platform/services/default-task-scheduler.service";
import {
  TASK_SCHEDULER_DISK,
  GlobalState,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/common/platform/state";

import { BrowserApi } from "../browser/browser-api";

import {
  ActiveAlarm,
  BrowserTaskSchedulerService as BrowserTaskSchedulerServiceInterface,
} from "./abstractions/browser-task-scheduler.service";

const ACTIVE_ALARMS = new KeyDefinition(TASK_SCHEDULER_DISK, "activeAlarms", {
  deserializer: (value: ActiveAlarm[]) => value ?? [],
});

export class BrowserTaskSchedulerService
  extends DefaultTaskSchedulerService
  implements BrowserTaskSchedulerServiceInterface
{
  private activeAlarmsState: GlobalState<ActiveAlarm[]>;
  readonly activeAlarms$: Observable<ActiveAlarm[]>;
  private recoveredAlarms: Set<string> = new Set();

  constructor(logService: LogService, stateProvider: StateProvider) {
    super(logService, stateProvider);

    this.activeAlarmsState = this.stateProvider.getGlobal(ACTIVE_ALARMS);
    this.activeAlarms$ = this.activeAlarmsState.state$.pipe(
      map((activeAlarms) => activeAlarms ?? []),
    );

    this.setupOnAlarmListener();
    this.verifyAlarmsState().catch((e) => this.logService.error(e));
  }

  /**
   * Sets a timeout to execute a callback after a delay. If the delay is less
   * than 1 minute, it will use the global setTimeout. Otherwise, it will
   * create a browser extension alarm to handle the delay.
   *
   * @param taskName - The name of the task, used in defining the alarm.
   * @param delayInMs - The delay in milliseconds.
   */
  async setTimeout(
    taskName: ScheduledTaskName,
    delayInMs: number,
  ): Promise<number | NodeJS.Timeout> {
    const delayInMinutes = delayInMs / 1000 / 60;
    if (delayInMinutes < 1) {
      return super.setTimeout(taskName, delayInMs);
    }

    if (this.recoveredAlarms.has(taskName)) {
      await this.triggerRecoveredAlarm(taskName);
      return;
    }

    await this.scheduleAlarm(taskName, { delayInMinutes });
  }

  /**
   * Sets an interval to execute a callback at each interval. If the interval is
   * less than 1 minute, it will use the global setInterval. Otherwise, it will
   * create a browser extension alarm to handle the interval.
   *
   * @param taskName - The name of the task, used in defining the alarm.
   * @param intervalInMs - The interval in milliseconds.
   * @param initialDelayInMs - The initial delay in milliseconds.
   */
  async setInterval(
    taskName: ScheduledTaskName,
    intervalInMs: number,
    initialDelayInMs?: number,
  ): Promise<number | NodeJS.Timeout> {
    const intervalInMinutes = intervalInMs / 1000 / 60;
    if (intervalInMinutes < 1) {
      return super.setInterval(taskName, intervalInMs);
    }

    if (this.recoveredAlarms.has(taskName)) {
      await this.triggerRecoveredAlarm(taskName, intervalInMinutes);
    }

    const initialDelayInMinutes = initialDelayInMs ? initialDelayInMs / 1000 / 60 : undefined;
    await this.scheduleAlarm(taskName, {
      periodInMinutes: intervalInMinutes,
      delayInMinutes: initialDelayInMinutes ?? intervalInMinutes,
    });
  }

  /**
   * Clears a scheduled task by its task identifier. If the task identifier
   * contains a task name, it will clear the browser extension alarm with that
   * name.
   *
   * @param taskIdentifier - The task identifier containing the task name.
   */
  async clearScheduledTask(taskIdentifier: TaskIdentifier): Promise<void> {
    void super.clearScheduledTask(taskIdentifier);

    const { taskName } = taskIdentifier;
    if (!taskName) {
      return;
    }

    const wasCleared = await this.clearAlarm(taskName);
    if (wasCleared) {
      await this.deleteActiveAlarm(taskName);
      this.recoveredAlarms.delete(taskName);
    }
  }

  /**
   * Clears all scheduled tasks by clearing all browser extension
   * alarms and resetting the active alarms state.
   */
  async clearAllScheduledTasks(): Promise<void> {
    await this.clearAllAlarms();
    await this.updateActiveAlarms([]);
    this.recoveredAlarms.clear();
  }

  /**
   * Creates a browser extension alarm with the given name and create info.
   *
   * @param taskName - The name of the alarm.
   * @param createInfo - The alarm create info.
   */
  private async scheduleAlarm(
    taskName: ScheduledTaskName,
    createInfo: chrome.alarms.AlarmCreateInfo,
  ): Promise<void> {
    const existingAlarm = await this.getAlarm(taskName);
    if (existingAlarm) {
      this.logService.warning(`Alarm ${taskName} already exists. Skipping creation.`);
      return;
    }

    await this.createAlarm(taskName, createInfo);

    await this.setActiveAlarm({
      taskName,
      startTime: Date.now(),
      createInfo,
    });
  }

  /**
   * Verifies the state of the active alarms by checking if
   * any alarms have been missed or need to be created.
   */
  private async verifyAlarmsState(): Promise<void> {
    const currentTime = Date.now();
    const activeAlarms = await firstValueFrom(this.activeAlarms$);

    for (const alarm of activeAlarms) {
      const { taskName, startTime, createInfo } = alarm;
      const existingAlarm = await this.getAlarm(taskName);
      if (existingAlarm) {
        continue;
      }

      const shouldAlarmHaveBeenTriggered = createInfo.when && createInfo.when < currentTime;
      const hasSetTimeoutAlarmExceededDelay =
        !createInfo.periodInMinutes &&
        createInfo.delayInMinutes &&
        startTime + createInfo.delayInMinutes * 60 * 1000 < currentTime;
      if (shouldAlarmHaveBeenTriggered || hasSetTimeoutAlarmExceededDelay) {
        this.recoveredAlarms.add(taskName);
        continue;
      }

      void this.scheduleAlarm(taskName, createInfo);
    }

    // 10 seconds after verifying the alarm state, we should treat any newly created alarms as non-recovered alarms.
    globalThis.setTimeout(() => this.recoveredAlarms.clear(), 10 * 1000);
  }

  /**
   * Sets an active alarm in state.
   *
   * @param alarm - The active alarm to set.
   */
  private async setActiveAlarm(alarm: ActiveAlarm): Promise<void> {
    const activeAlarms = await firstValueFrom(this.activeAlarms$);
    activeAlarms.push(alarm);
    await this.updateActiveAlarms(activeAlarms);
  }

  /**
   * Deletes an active alarm from state.
   *
   * @param taskName - The name of the active alarm to delete.
   */
  private async deleteActiveAlarm(taskName: ScheduledTaskName): Promise<void> {
    const activeAlarms = await firstValueFrom(this.activeAlarms$);
    const filteredAlarms = activeAlarms?.filter((alarm) => alarm.taskName !== taskName);
    await this.updateActiveAlarms(filteredAlarms || []);
  }

  /**
   * Updates the active alarms state with the given alarms.
   *
   * @param alarms - The alarms to update the state with.
   */
  private async updateActiveAlarms(alarms: ActiveAlarm[]): Promise<void> {
    await this.activeAlarmsState.update(() => alarms);
  }

  /**
   * Triggers a recovered alarm by deleting it from the recovered alarms set
   *
   * @param name - The name of the recovered alarm to trigger.
   * @param periodInMinutes - The period in minutes of the recovered alarm.
   */
  private async triggerRecoveredAlarm(
    name: ScheduledTaskName,
    periodInMinutes?: number,
  ): Promise<void> {
    this.recoveredAlarms.delete(name);
    await this.triggerTask(name, periodInMinutes);
  }

  /**
   * Sets up the on alarm listener to handle alarms.
   */
  private setupOnAlarmListener(): void {
    BrowserApi.addListener(chrome.alarms.onAlarm, this.handleOnAlarm);
  }

  /**
   * Handles on alarm events, triggering the alarm if a handler exists.
   *
   * @param alarm - The alarm to handle.
   */
  private handleOnAlarm = async (alarm: chrome.alarms.Alarm): Promise<void> => {
    const { name, periodInMinutes } = alarm;
    await this.triggerTask(name as ScheduledTaskName, periodInMinutes);
  };

  /**
   * Triggers an alarm by calling its handler and
   * deleting it if it is a one-time alarm.
   *
   * @param alarmName - The name of the alarm to trigger.
   * @param periodInMinutes - The period in minutes of an interval alarm.
   */
  protected async triggerTask(
    alarmName: ScheduledTaskName,
    periodInMinutes?: number,
  ): Promise<void> {
    const activeUserAlarmName = await this.getActiveUserAlarmName(alarmName);
    const handler = this.taskHandlers.get(activeUserAlarmName);
    if (!periodInMinutes) {
      await this.deleteActiveAlarm(alarmName);
    }

    if (handler) {
      handler();
    }
  }

  /**
   * Clears a new alarm with the given name and create info. Returns a promise
   * that indicates when the alarm has been cleared successfully.
   *
   * @param taskName - The name of the alarm to create.
   */
  async clearAlarm(taskName: string): Promise<boolean> {
    const activeUserAlarmName = await this.getActiveUserAlarmName(taskName);
    if (typeof browser !== "undefined" && browser.alarms) {
      return browser.alarms.clear(activeUserAlarmName);
    }

    return new Promise((resolve) => chrome.alarms.clear(activeUserAlarmName, resolve));
  }

  /**
   * Clears all alarms that have been set by the extension. Returns a promise
   * that indicates when all alarms have been cleared successfully.
   */
  clearAllAlarms(): Promise<boolean> {
    if (typeof browser !== "undefined" && browser.alarms) {
      return browser.alarms.clearAll();
    }

    return new Promise((resolve) => chrome.alarms.clearAll(resolve));
  }

  /**
   * Creates a new alarm with the given name and create info.
   *
   * @param taskName - The name of the alarm to create.
   * @param createInfo - The creation info for the alarm.
   */
  async createAlarm(taskName: string, createInfo: chrome.alarms.AlarmCreateInfo): Promise<void> {
    const activeUserAlarmName = await this.getActiveUserAlarmName(taskName);
    if (typeof browser !== "undefined" && browser.alarms) {
      return browser.alarms.create(activeUserAlarmName, createInfo);
    }

    return new Promise((resolve) => chrome.alarms.create(activeUserAlarmName, createInfo, resolve));
  }

  /**
   * Gets the alarm with the given name.
   *
   * @param taskName - The name of the alarm to get.
   */
  async getAlarm(taskName: string): Promise<chrome.alarms.Alarm> {
    const activeUserAlarmName = await this.getActiveUserAlarmName(taskName);
    if (typeof browser !== "undefined" && browser.alarms) {
      return browser.alarms.get(activeUserAlarmName);
    }

    return new Promise((resolve) => chrome.alarms.get(activeUserAlarmName, resolve));
  }

  /**
   * Gets all alarms that have been set by the extension.
   */
  getAllAlarms(): Promise<chrome.alarms.Alarm[]> {
    if (typeof browser !== "undefined" && browser.alarms) {
      return browser.alarms.getAll();
    }

    return new Promise((resolve) => chrome.alarms.getAll(resolve));
  }

  protected async getActiveUserAlarmName(taskName: string): Promise<string> {
    const activeUserId = await firstValueFrom(this.stateProvider.activeUserId$);
    if (!activeUserId) {
      return taskName;
    }

    return `${activeUserId}_${taskName}`;
  }
}
