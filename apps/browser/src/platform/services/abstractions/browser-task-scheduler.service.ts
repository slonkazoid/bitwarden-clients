import { Observable } from "rxjs";

import { ScheduledTaskName } from "@bitwarden/common/platform/scheduling/scheduled-task-name.enum";
import { TaskSchedulerService } from "@bitwarden/common/platform/scheduling/task-scheduler.service";

export const BrowserTaskSchedulerPortName = "browser-task-scheduler-port";

export const BrowserTaskSchedulerPortActions = {
  setTimeout: "setTimeout",
  setInterval: "setInterval",
  clearAlarm: "clearAlarm",
} as const;
export type BrowserTaskSchedulerPortAction = keyof typeof BrowserTaskSchedulerPortActions;

export type BrowserTaskSchedulerPortMessage = {
  action: BrowserTaskSchedulerPortAction;
  taskName: ScheduledTaskName;
  alarmName?: string;
  delayInMs?: number;
  intervalInMs?: number;
};

export type ActiveAlarm = {
  alarmName: string;
  startTime: number;
  createInfo: chrome.alarms.AlarmCreateInfo;
};

export abstract class BrowserTaskSchedulerService extends TaskSchedulerService {
  activeAlarms$: Observable<ActiveAlarm[]>;
  abstract clearAllScheduledTasks(): Promise<void>;
  abstract verifyAlarmsState(): Promise<void>;
  abstract clearScheduledAlarm(alarmName: string): Promise<void>;
}
