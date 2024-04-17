import { TaskIdentifier, TaskSchedulerService } from "../abstractions/task-scheduler.service";
import { ScheduledTaskName } from "../enums/scheduled-task-name.enum";

export class DefaultTaskSchedulerService extends TaskSchedulerService {
  /**
   * Sets a timeout and returns the timeout id.
   *
   * @param callback - The function to be called after the delay.
   * @param delayInMs - The delay in milliseconds.
   * @param _taskName - The name of the task. Unused in the base implementation.
   */
  async setTimeout(
    callback: () => void,
    delayInMs: number,
    _taskName?: ScheduledTaskName,
  ): Promise<number | NodeJS.Timeout> {
    return globalThis.setTimeout(() => callback(), delayInMs);
  }

  /**
   * Sets an interval and returns the interval id.
   *
   * @param callback - The function to be called at each interval.
   * @param intervalInMs - The interval in milliseconds.
   * @param _taskName - The name of the task. Unused in the base implementation.
   * @param _initialDelayInMs - The initial delay in milliseconds. Unused in the base implementation.
   */
  async setInterval(
    callback: () => void,
    intervalInMs: number,
    _taskName?: ScheduledTaskName,
    _initialDelayInMs?: number,
  ): Promise<number | NodeJS.Timeout> {
    return globalThis.setInterval(() => callback(), intervalInMs);
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
}
