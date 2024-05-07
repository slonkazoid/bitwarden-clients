import { LogService } from "../abstractions/log.service";
import { TaskIdentifier, TaskSchedulerService } from "../abstractions/task-scheduler.service";
import { ScheduledTaskName } from "../enums/scheduled-task-name.enum";

export class DefaultTaskSchedulerService extends TaskSchedulerService {
  constructor(protected logService: LogService) {
    super();

    this.taskHandlers = new Map();
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
    this.validateRegisteredTask(taskName);

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
    this.validateRegisteredTask(taskName);

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

  /**
   * Registers a task handler.
   *
   * @param taskName - The name of the task.
   * @param handler - The task handler.
   */
  registerTaskHandler(taskName: ScheduledTaskName, handler: () => void) {
    const existingHandler = this.taskHandlers.get(taskName);
    if (existingHandler) {
      this.logService.warning(`Task handler for ${taskName} already exists. Overwriting.`);
      this.unregisterTaskHandler(taskName);
    }

    this.taskHandlers.set(taskName, handler);
  }

  /**
   * Unregisters a task handler.
   *
   * @param taskName - The name of the task.
   */
  unregisterTaskHandler(taskName: ScheduledTaskName) {
    this.taskHandlers.delete(taskName);
  }

  /**
   * Triggers a task.
   *
   * @param taskName - The name of the task.
   * @param _periodInMinutes - The period in minutes. Unused in the base implementation.
   */
  protected async triggerTask(
    taskName: ScheduledTaskName,
    _periodInMinutes?: number,
  ): Promise<void> {
    const handler = this.taskHandlers.get(taskName);
    if (handler) {
      handler();
    }
  }

  /**
   * Validates that a task handler is registered.
   *
   * @param taskName - The name of the task.
   */
  protected validateRegisteredTask(taskName: ScheduledTaskName): void {
    if (!this.taskHandlers.has(taskName)) {
      throw new Error(`Task handler for ${taskName} not registered. Unable to schedule task.`);
    }
  }
}
