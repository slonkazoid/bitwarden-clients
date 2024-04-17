import { firstValueFrom } from "rxjs";

import { LogService } from "../abstractions/log.service";
import { TaskIdentifier, TaskSchedulerService } from "../abstractions/task-scheduler.service";
import { ScheduledTaskName } from "../enums/scheduled-task-name.enum";
import { StateProvider } from "../state";

export class DefaultTaskSchedulerService extends TaskSchedulerService {
  constructor(logService: LogService, stateProvider: StateProvider) {
    super(logService, stateProvider);

    this.taskHandlers = new Map();
  }

  async registerTaskHandler(taskName: ScheduledTaskName, handler: () => void): Promise<void> {
    const activeUserTaskName = await this.getActiveUserTaskName(taskName);
    const existingHandler = this.taskHandlers.get(activeUserTaskName);
    if (existingHandler) {
      this.logService.warning(`Task handler for ${taskName} already exists. Overwriting.`);
      await this.unregisterTaskHandler(taskName);
    }

    this.taskHandlers.set(activeUserTaskName, handler);
  }

  async unregisterTaskHandler(taskName: ScheduledTaskName): Promise<void> {
    const activeUserTaskName = await this.getActiveUserTaskName(taskName);
    this.taskHandlers.delete(activeUserTaskName);
  }

  protected triggerTask(taskName: ScheduledTaskName, _periodInMinutes?: number): void {
    const handler = this.taskHandlers.get(taskName);
    if (handler) {
      handler();
    }
  }

  /**
   * Sets a timeout and returns the timeout id.
   *
   * @param taskName - The name of the task. Unused in the base implementation.
   * @param delayInMs - The delay in milliseconds.
   */
  async setTimeout(
    taskName: ScheduledTaskName,
    delayInMs: number,
  ): Promise<number | NodeJS.Timeout> {
    return globalThis.setTimeout(() => this.triggerTask(taskName), delayInMs);
  }

  /**
   * Sets an interval and returns the interval id.
   *
   * @param taskName - The name of the task. Unused in the base implementation.
   * @param intervalInMs - The interval in milliseconds.
   * @param _initialDelayInMs - The initial delay in milliseconds. Unused in the base implementation.
   */
  async setInterval(
    taskName: ScheduledTaskName,
    intervalInMs: number,
    _initialDelayInMs?: number,
  ): Promise<number | NodeJS.Timeout> {
    return globalThis.setInterval(() => this.triggerTask(taskName), intervalInMs);
  }

  /**
   * Clears a scheduled task.
   *
   * @param taskIdentifier - The task identifier containing the timeout or interval id.
   */
  async clearScheduledTask(taskIdentifier: TaskIdentifier): Promise<void> {
    if (taskIdentifier.timeoutId) {
      globalThis.clearTimeout(taskIdentifier.timeoutId);
    }

    if (taskIdentifier.intervalId) {
      globalThis.clearInterval(taskIdentifier.intervalId);
    }
  }

  private async getActiveUserTaskName(taskName: ScheduledTaskName): Promise<string> {
    const activeUserId = await firstValueFrom(this.stateProvider.activeUserId$);
    if (!activeUserId) {
      return taskName;
    }

    return `${activeUserId}_${taskName}`;
  }
}
