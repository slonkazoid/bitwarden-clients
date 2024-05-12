import { Subscription } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ScheduledTaskName } from "@bitwarden/common/platform/enums/scheduled-task-name.enum";
import { StateProvider } from "@bitwarden/common/platform/state";

import {
  BrowserTaskSchedulerPortActions,
  BrowserTaskSchedulerPortMessage,
  BrowserTaskSchedulerPortName,
} from "../abstractions/browser-task-scheduler.service";

import { BrowserTaskSchedulerServiceImplementation } from "./browser-task-scheduler.service";

export class ForegroundTaskSchedulerService extends BrowserTaskSchedulerServiceImplementation {
  private port: chrome.runtime.Port;

  constructor(logService: LogService, stateProvider: StateProvider) {
    super(logService, stateProvider);

    this.port = chrome.runtime.connect({ name: BrowserTaskSchedulerPortName });
    this.port.onMessage.addListener(this.handlePortMessage);
  }

  /**
   * Sends a port message to the background to set up a fallback timeout. Also sets a timeout locally.
   * This is done to ensure that the timeout triggers even if the popup is closed.
   *
   * @param taskName - The name of the task.
   * @param delayInMs - The delay in milliseconds.
   */
  setTimeout(taskName: ScheduledTaskName, delayInMs: number): Subscription {
    this.sendPortMessage({
      action: BrowserTaskSchedulerPortActions.setTimeout,
      taskName,
      delayInMs,
    });

    return super.setTimeout(taskName, delayInMs);
  }

  /**
   * Sends a port message to the background to set up a fallback interval. Also sets an interval locally.
   * This is done to ensure that the interval triggers even if the popup is closed.
   *
   * @param taskName - The name of the task.
   * @param intervalInMs - The interval in milliseconds.
   * @param initialDelayInMs - The initial delay in milliseconds.
   */
  setInterval(
    taskName: ScheduledTaskName,
    intervalInMs: number,
    initialDelayInMs?: number,
  ): Subscription {
    this.sendPortMessage({
      action: BrowserTaskSchedulerPortActions.setInterval,
      taskName,
      intervalInMs,
    });

    return super.setInterval(taskName, intervalInMs, initialDelayInMs);
  }

  /**
   * Handles port messages from the background task scheduler.
   *
   * @param message - The message that indicates we should clear an alarm.
   * @param port - The port that the message was received on.
   */
  private handlePortMessage = (
    message: BrowserTaskSchedulerPortMessage,
    port: chrome.runtime.Port,
  ) => {
    if (port.name !== BrowserTaskSchedulerPortName) {
      return;
    }

    if (message.action === BrowserTaskSchedulerPortActions.clearAlarm) {
      void super.clearScheduledAlarm(message.alarmName);
    }
  };

  /**
   * Sends a message to the background task scheduler.
   *
   * @param message - The message to send.
   */
  private sendPortMessage(message: BrowserTaskSchedulerPortMessage) {
    this.port.postMessage(message);
  }
}
