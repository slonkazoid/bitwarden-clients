import { TaskSchedulerService } from "@bitwarden/common/platform/abstractions/task-scheduler.service";

export type ActiveAlarm = {
  alarmName: string;
  startTime: number;
  createInfo: chrome.alarms.AlarmCreateInfo;
};

export interface BrowserTaskSchedulerService extends TaskSchedulerService {
  clearAllScheduledTasks(): Promise<void>;
  verifyAlarmsState(): Promise<void>;
}
