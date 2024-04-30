import { Observable } from "rxjs";

import { TaskSchedulerService } from "@bitwarden/common/platform/abstractions/task-scheduler.service";

export type ActiveAlarm = {
  alarmName: string;
  startTime: number;
  createInfo: chrome.alarms.AlarmCreateInfo;
};

export abstract class BrowserTaskSchedulerService extends TaskSchedulerService {
  activeAlarms$: Observable<ActiveAlarm[]>;
  abstract clearAllScheduledTasks(): Promise<void>;
  abstract verifyAlarmsState(): Promise<void>;
}
