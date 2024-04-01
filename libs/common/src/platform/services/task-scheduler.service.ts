import {
  TaskIdentifier,
  TaskSchedulerService as TaskSchedulerServiceInterface,
} from "../abstractions/task-scheduler.service";
import { ScheduledTaskName } from "../enums/scheduled-task-name.enum";

export class TaskSchedulerService implements TaskSchedulerServiceInterface {
  async setTimeout(
    callback: () => void,
    delayInMs: number,
    _taskName?: ScheduledTaskName,
  ): Promise<number | NodeJS.Timeout> {
    return setTimeout(() => callback(), delayInMs);
  }

  async setInterval(
    callback: () => void,
    intervalInMs: number,
    _taskName?: ScheduledTaskName,
    _initialDelayInMs?: number,
  ): Promise<number | NodeJS.Timeout> {
    return setInterval(() => callback(), intervalInMs);
  }

  async clearScheduledTask(taskIdentifier: TaskIdentifier): Promise<void> {
    if (taskIdentifier.timeoutId) {
      clearTimeout(taskIdentifier.timeoutId);
      return;
    }

    if (taskIdentifier.intervalId) {
      clearInterval(taskIdentifier.intervalId);
    }
  }
}
