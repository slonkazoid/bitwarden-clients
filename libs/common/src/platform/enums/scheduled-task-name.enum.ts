export const ScheduledTaskNames = {
  clearClipboardTimeout: "clearClipboardTimeout",
  systemClearClipboardTimeout: "systemClearClipboardTimeout",
  scheduleNextSyncTimeout: "scheduleNextSyncTimeout",
  loginStrategySessionTimeout: "loginStrategySessionTimeout",
  notificationsReconnectTimeout: "notificationsReconnectTimeout",
  fido2ClientAbortTimeout: "fido2ClientAbortTimeout",
  eventUploadsInterval: "eventUploadsInterval",
} as const;

export type ScheduledTaskName = (typeof ScheduledTaskNames)[keyof typeof ScheduledTaskNames];
