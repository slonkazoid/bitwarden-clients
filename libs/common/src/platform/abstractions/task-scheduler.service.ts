import { ScheduledTaskName } from "../enums/scheduled-task-name.enum";

export type TaskIdentifier = {
  taskName?: ScheduledTaskName;
  timeoutId?: number | NodeJS.Timeout;
  intervalId?: number | NodeJS.Timeout;
};

export abstract class TaskSchedulerService {
  abstract setTimeout(
    callback: () => void,
    delayInMs: number,
    taskName?: ScheduledTaskName,
  ): Promise<number | NodeJS.Timeout>;
  abstract setInterval(
    callback: () => void,
    intervalInMs: number,
    taskName?: ScheduledTaskName,
    initialDelayInMs?: number,
  ): Promise<number | NodeJS.Timeout>;
  abstract clearScheduledTask(taskIdentifier: TaskIdentifier): Promise<void>;
}
