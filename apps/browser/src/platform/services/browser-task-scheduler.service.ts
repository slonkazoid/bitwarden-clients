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

  constructor(logService: LogService, stateProvider: StateProvider) {
    super(logService, stateProvider);

    this.activeAlarmsState = this.stateProvider.getGlobal(ACTIVE_ALARMS);
    this.activeAlarms$ = this.activeAlarmsState.state$.pipe(
      map((activeAlarms) => activeAlarms ?? []),
    );

    this.setupOnAlarmListener();
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

    const alarmName = await this.getActiveUserAlarmName(taskName);
    await this.scheduleAlarm(alarmName, { delayInMinutes });
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

    const alarmName = await this.getActiveUserAlarmName(taskName);
    const initialDelayInMinutes = initialDelayInMs ? initialDelayInMs / 1000 / 60 : undefined;
    await this.scheduleAlarm(alarmName, {
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

    const alarmName = await this.getActiveUserAlarmName(taskName);
    await this.clearScheduledAlarm(alarmName);
  }

  /**
   * Clears all scheduled tasks by clearing all browser extension
   * alarms and resetting the active alarms state.
   */
  async clearAllScheduledTasks(): Promise<void> {
    await this.clearAllAlarms();
    await this.updateActiveAlarms([]);
  }

  /**
   * Verifies the state of the active alarms by checking if
   * any alarms have been missed or need to be created.
   */
  async verifyAlarmsState(): Promise<void> {
    const currentTime = Date.now();
    const activeAlarms = await firstValueFrom(this.activeAlarms$);

    for (const alarm of activeAlarms) {
      const { alarmName, startTime, createInfo } = alarm;
      if (!alarmName) {
        return;
      }

      const existingAlarm = await this.getAlarm(alarmName);
      if (existingAlarm) {
        continue;
      }

      const shouldAlarmHaveBeenTriggered = createInfo.when && createInfo.when < currentTime;
      const hasSetTimeoutAlarmExceededDelay =
        !createInfo.periodInMinutes &&
        createInfo.delayInMinutes &&
        startTime + createInfo.delayInMinutes * 60 * 1000 < currentTime;
      if (shouldAlarmHaveBeenTriggered || hasSetTimeoutAlarmExceededDelay) {
        await this.triggerRecoveredAlarm(alarmName);
        continue;
      }

      void this.scheduleAlarm(alarmName, createInfo);
    }
  }

  /**
   * Creates a browser extension alarm with the given name and create info.
   *
   * @param alarmName - The name of the alarm.
   * @param createInfo - The alarm create info.
   */
  private async scheduleAlarm(
    alarmName: string,
    createInfo: chrome.alarms.AlarmCreateInfo,
  ): Promise<void> {
    if (!alarmName) {
      return;
    }

    const existingAlarm = await this.getAlarm(alarmName);
    if (existingAlarm) {
      this.logService.warning(`Alarm ${alarmName} already exists. Skipping creation.`);
      return;
    }

    // We should always prioritize user-based alarms over non-user-based alarms. If a non-user-based alarm
    // exists when the user-based alarm is being created, we want to clear the non-user-based alarm.
    const taskName = this.getTaskFromAlarmName(alarmName);
    const existingTaskBasedAlarm = await this.getAlarm(taskName);
    if (existingTaskBasedAlarm) {
      await this.clearScheduledAlarm(taskName);
    }

    await this.createAlarm(alarmName, createInfo);
    await this.setActiveAlarm(alarmName, createInfo);
  }

  /**
   * Sets an active alarm in state.
   *
   * @param alarmName - The name of the active alarm to set.
   * @param createInfo - The creation info of the active alarm.
   */
  private async setActiveAlarm(
    alarmName: string,
    createInfo: chrome.alarms.AlarmCreateInfo,
  ): Promise<void> {
    const activeAlarms = await firstValueFrom(this.activeAlarms$);
    const filteredAlarms = activeAlarms.filter((alarm) => alarm.alarmName !== alarmName);
    filteredAlarms.push({
      alarmName,
      startTime: Date.now(),
      createInfo,
    });
    await this.updateActiveAlarms(filteredAlarms);
  }

  /**
   * Deletes an active alarm from state.
   *
   * @param alarmName - The name of the active alarm to delete.
   */
  private async deleteActiveAlarm(alarmName: string): Promise<void> {
    const activeAlarms = await firstValueFrom(this.activeAlarms$);
    const filteredAlarms = activeAlarms.filter((alarm) => alarm.alarmName !== alarmName);
    await this.updateActiveAlarms(filteredAlarms || []);
  }

  private async clearScheduledAlarm(alarmName: string): Promise<void> {
    const wasCleared = await this.clearAlarm(alarmName);
    if (wasCleared) {
      await this.deleteActiveAlarm(alarmName);
    }
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
   * @param alarmName - The name of the recovered alarm to trigger.
   * @param periodInMinutes - The period in minutes of the recovered alarm.
   */
  private async triggerRecoveredAlarm(alarmName: string, periodInMinutes?: number): Promise<void> {
    await this.triggerTask(alarmName, periodInMinutes);
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
    await this.triggerTask(name, periodInMinutes);
  };

  /**
   * Triggers an alarm by calling its handler and
   * deleting it if it is a one-time alarm.
   *
   * @param alarmName - The name of the alarm to trigger.
   * @param periodInMinutes - The period in minutes of an interval alarm.
   */
  protected async triggerTask(alarmName: string, periodInMinutes?: number): Promise<void> {
    const taskName = this.getTaskFromAlarmName(alarmName);
    const handler = this.taskHandlers.get(taskName);
    if (!periodInMinutes) {
      await this.deleteActiveAlarm(alarmName);
    }

    if (handler) {
      handler();
    }

    // We should always prioritize user-based alarms over non-user-based alarms. As a result, if a triggered
    // alarm is not user-based, we want to verify if  the alarm should continue to exist. If an alarm exists
    // for the same task that is user-based, we want to clear the non-user-based alarm.
    if (alarmName === taskName) {
      const taskName = this.getTaskFromAlarmName(alarmName);
      const existingUserBasedAlarm = await this.getAlarm(taskName);
      if (existingUserBasedAlarm) {
        await this.clearScheduledAlarm(taskName);
      }
    }
  }

  private async getActiveUserAlarmName(taskName: ScheduledTaskName): Promise<string> {
    const activeUserId = await firstValueFrom(this.stateProvider.activeUserId$);
    if (!activeUserId) {
      return taskName;
    }

    return `${activeUserId}__${taskName}`;
  }

  private getTaskFromAlarmName(alarmName: string): ScheduledTaskName {
    const activeUserTask = alarmName.split("__")[1] as ScheduledTaskName;
    if (activeUserTask) {
      return activeUserTask;
    }

    return alarmName as ScheduledTaskName;
  }

  /**
   * Clears a new alarm with the given name and create info. Returns a promise
   * that indicates when the alarm has been cleared successfully.
   *
   * @param alarmName - The name of the alarm to create.
   */
  private async clearAlarm(alarmName: string): Promise<boolean> {
    if (typeof browser !== "undefined" && browser.alarms) {
      return browser.alarms.clear(alarmName);
    }

    return new Promise((resolve) => chrome.alarms.clear(alarmName, resolve));
  }

  /**
   * Clears all alarms that have been set by the extension. Returns a promise
   * that indicates when all alarms have been cleared successfully.
   */
  private clearAllAlarms(): Promise<boolean> {
    if (typeof browser !== "undefined" && browser.alarms) {
      return browser.alarms.clearAll();
    }

    return new Promise((resolve) => chrome.alarms.clearAll(resolve));
  }

  /**
   * Creates a new alarm with the given name and create info.
   *
   * @param alarmName - The name of the alarm to create.
   * @param createInfo - The creation info for the alarm.
   */
  private async createAlarm(
    alarmName: string,
    createInfo: chrome.alarms.AlarmCreateInfo,
  ): Promise<void> {
    if (typeof browser !== "undefined" && browser.alarms) {
      return browser.alarms.create(alarmName, createInfo);
    }

    return new Promise((resolve) => chrome.alarms.create(alarmName, createInfo, resolve));
  }

  /**
   * Gets the alarm with the given name.
   *
   * @param alarmName - The name of the alarm to get.
   */
  private async getAlarm(alarmName: string): Promise<chrome.alarms.Alarm> {
    if (typeof browser !== "undefined" && browser.alarms) {
      return browser.alarms.get(alarmName);
    }

    return new Promise((resolve) => chrome.alarms.get(alarmName, resolve));
  }
}
