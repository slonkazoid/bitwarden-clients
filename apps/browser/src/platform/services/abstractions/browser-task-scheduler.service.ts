import { TaskSchedulerService } from "@bitwarden/common/platform/abstractions/task-scheduler.service";
import { ScheduledTaskName } from "@bitwarden/common/platform/enums/scheduled-task-name.enum";

export type ActiveAlarm = {
  taskName: ScheduledTaskName;
  startTime: number;
  createInfo: chrome.alarms.AlarmCreateInfo;
};

export interface BrowserTaskSchedulerService extends TaskSchedulerService {
  clearAllScheduledTasks(): Promise<void>;
}
