import { mock, MockProxy } from "jest-mock-extended";
import { Observable } from "rxjs";

import { ScheduledTaskNames } from "@bitwarden/common/platform/enums/scheduled-task-name.enum";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";

import { BrowserApi } from "../browser/browser-api";

import { ActiveAlarm } from "./abstractions/browser-task-scheduler.service";
import { BrowserTaskSchedulerService } from "./browser-task-scheduler.service";

let activeAlarms: ActiveAlarm[] = [];
jest.mock("rxjs", () => ({
  firstValueFrom: jest.fn(() => Promise.resolve(activeAlarms)),
  map: jest.fn(),
  Observable: jest.fn(),
}));

describe("BrowserTaskSchedulerService", () => {
  let logService: MockProxy<ConsoleLogService>;
  let stateProvider: MockProxy<StateProvider>;
  let browserTaskSchedulerService: BrowserTaskSchedulerService;
  const eventUploadsIntervalCreateInfo = { periodInMinutes: 5, delayInMinutes: 5 };
  const scheduleNextSyncIntervalCreateInfo = { periodInMinutes: 5, delayInMinutes: 5 };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(BrowserApi, "getAlarm").mockImplementation((alarmName) => {
      if (alarmName === ScheduledTaskNames.scheduleNextSyncInterval) {
        return Promise.resolve(mock<chrome.alarms.Alarm>({ name: alarmName }));
      }
    });
    activeAlarms = [
      mock<ActiveAlarm>({
        name: ScheduledTaskNames.eventUploadsInterval,
        createInfo: eventUploadsIntervalCreateInfo,
      }),
      mock<ActiveAlarm>({
        name: ScheduledTaskNames.scheduleNextSyncInterval,
        createInfo: scheduleNextSyncIntervalCreateInfo,
      }),
      mock<ActiveAlarm>({
        name: ScheduledTaskNames.fido2ClientAbortTimeout,
        startTime: Date.now() - 60001,
        createInfo: { delayInMinutes: 1, periodInMinutes: undefined },
      }),
    ];
    logService = mock<ConsoleLogService>();
    stateProvider = mock<StateProvider>({
      getGlobal: jest.fn(() =>
        mock<GlobalState<any>>({
          state$: mock<Observable<any>>(),
        }),
      ),
    });
    browserTaskSchedulerService = new BrowserTaskSchedulerService(logService, stateProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe("verifyAlarmsState", () => {
    it("verifies the status of potentially existing alarms referenced from state on initialization", () => {
      expect(chrome.alarms.create).toHaveBeenCalledWith(
        ScheduledTaskNames.eventUploadsInterval,
        eventUploadsIntervalCreateInfo,
        expect.any(Function),
      );
    });

    it("skips creating an alarm if the alarm already exists", () => {
      expect(chrome.alarms.create).not.toHaveBeenCalledWith(
        ScheduledTaskNames.scheduleNextSyncInterval,
        scheduleNextSyncIntervalCreateInfo,
        expect.any(Function),
      );
    });

    it("adds the alarm name to the set of recovered alarms if the alarm create info indicates it has expired", () => {
      expect(
        browserTaskSchedulerService["recoveredAlarms"].has(
          ScheduledTaskNames.fido2ClientAbortTimeout,
        ),
      ).toBe(true);
    });

    it("clears the list of recovered alarms after 10 seconds", () => {
      jest.advanceTimersByTime(10 * 1000);

      expect(
        browserTaskSchedulerService["recoveredAlarms"].has(
          ScheduledTaskNames.fido2ClientAbortTimeout,
        ),
      ).toBe(false);
    });
  });

  describe("setTimeout", () => {
    it("uses the global setTimeout API if the delay is less than 1000ms", async () => {
      const callback = jest.fn();
      const delayInMs = 999;
      jest.spyOn(globalThis, "setTimeout");

      await browserTaskSchedulerService.setTimeout(
        callback,
        delayInMs,
        ScheduledTaskNames.loginStrategySessionTimeout,
      );

      expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), delayInMs);
      expect(chrome.alarms.create).not.toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { delayInMinutes: 1 },
        expect.any(Function),
      );
    });

    it("triggers a recovered alarm immediately and skips creating the alarm", async () => {
      activeAlarms = [mock<ActiveAlarm>({ name: ScheduledTaskNames.loginStrategySessionTimeout })];
      browserTaskSchedulerService["recoveredAlarms"].add(
        ScheduledTaskNames.loginStrategySessionTimeout,
      );
      const callback = jest.fn();

      await browserTaskSchedulerService.setTimeout(
        callback,
        60 * 1000,
        ScheduledTaskNames.loginStrategySessionTimeout,
      );

      expect(callback).toHaveBeenCalled();
      expect(chrome.alarms.create).not.toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { delayInMinutes: 1 },
        expect.any(Function),
      );
    });

    it("creates a timeout alarm", async () => {
      const callback = jest.fn();
      const delayInMinutes = 2;

      await browserTaskSchedulerService.setTimeout(
        callback,
        delayInMinutes * 60 * 1000,
        ScheduledTaskNames.loginStrategySessionTimeout,
      );

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { delayInMinutes },
        expect.any(Function),
      );
    });

    it("skips creating a duplicate timeout alarm", async () => {
      const callback = jest.fn();
      const delayInMinutes = 2;
      jest.spyOn(BrowserApi, "getAlarm").mockResolvedValue(
        mock<chrome.alarms.Alarm>({
          name: ScheduledTaskNames.loginStrategySessionTimeout,
        }),
      );
      jest.spyOn(BrowserApi, "createAlarm");

      await browserTaskSchedulerService.setTimeout(
        callback,
        delayInMinutes * 60 * 1000,
        ScheduledTaskNames.loginStrategySessionTimeout,
      );

      expect(BrowserApi.createAlarm).not.toHaveBeenCalled();
    });

    it("logs a warning if a duplicate handler is registered when creating an alarm", () => {
      const callback = jest.fn();
      const name = ScheduledTaskNames.loginStrategySessionTimeout;
      browserTaskSchedulerService["onAlarmHandlers"][name] = jest.fn();

      browserTaskSchedulerService["registerAlarmHandler"](name, callback);

      expect(logService.warning).toHaveBeenCalledWith(
        `Alarm handler for ${name} already exists. Overwriting.`,
      );
    });
  });

  describe("setInterval", () => {
    it("uses the global setInterval API if the interval is less than 1000ms", async () => {
      const callback = jest.fn();
      const intervalInMs = 999;
      jest.spyOn(globalThis, "setInterval");

      await browserTaskSchedulerService.setInterval(
        callback,
        intervalInMs,
        ScheduledTaskNames.loginStrategySessionTimeout,
      );

      expect(globalThis.setInterval).toHaveBeenCalledWith(expect.any(Function), intervalInMs);
      expect(chrome.alarms.create).not.toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { periodInMinutes: 1, delayInMinutes: 1 },
        expect.any(Function),
      );
    });

    it("triggers a recovered alarm before creating the interval alarm", async () => {
      const periodInMinutes = 4;
      activeAlarms = [mock<ActiveAlarm>({ name: ScheduledTaskNames.loginStrategySessionTimeout })];
      browserTaskSchedulerService["recoveredAlarms"].add(
        ScheduledTaskNames.loginStrategySessionTimeout,
      );
      const callback = jest.fn();

      await browserTaskSchedulerService.setInterval(
        callback,
        periodInMinutes * 60 * 1000,
        ScheduledTaskNames.loginStrategySessionTimeout,
      );

      expect(callback).toHaveBeenCalled();
      expect(chrome.alarms.create).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { periodInMinutes, delayInMinutes: periodInMinutes },
        expect.any(Function),
      );
    });

    it("creates an interval alarm", async () => {
      const callback = jest.fn();
      const periodInMinutes = 2;
      const initialDelayInMs = 1000;

      await browserTaskSchedulerService.setInterval(
        callback,
        periodInMinutes * 60 * 1000,
        ScheduledTaskNames.loginStrategySessionTimeout,
        initialDelayInMs,
      );

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { periodInMinutes, delayInMinutes: initialDelayInMs / 1000 / 60 },
        expect.any(Function),
      );
    });
  });
});
