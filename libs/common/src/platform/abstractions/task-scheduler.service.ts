import { ScheduledTaskName } from "../enums/scheduled-task-name.enum";
import { StateProvider } from "../state";

import { LogService } from "./log.service";

export type TaskIdentifier = {
  taskName?: ScheduledTaskName;
  timeoutId?: number | NodeJS.Timeout;
  intervalId?: number | NodeJS.Timeout;
};

export abstract class TaskSchedulerService {
  constructor(
    protected logService: LogService,
    protected stateProvider: StateProvider,
  ) {}
  protected taskHandlers: Map<string, () => void>;
  abstract setTimeout(
    taskName: ScheduledTaskName,
    delayInMs: number,
  ): Promise<number | NodeJS.Timeout>;
  abstract setInterval(
    taskName: ScheduledTaskName,
    intervalInMs: number,
    initialDelayInMs?: number,
  ): Promise<number | NodeJS.Timeout>;
  abstract clearScheduledTask(taskIdentifier: TaskIdentifier): Promise<void>;
  abstract registerTaskHandler(taskName: ScheduledTaskName, handler: () => void): void;
  abstract unregisterTaskHandler(taskName: ScheduledTaskName): void;
  protected abstract triggerTask(taskName: ScheduledTaskName, periodInMinutes?: number): void;
}
