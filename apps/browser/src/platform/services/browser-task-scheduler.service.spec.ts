import { mock, MockProxy } from "jest-mock-extended";
import { Observable } from "rxjs";

import { TaskIdentifier } from "@bitwarden/common/platform/abstractions/task-scheduler.service";
import { ScheduledTaskNames } from "@bitwarden/common/platform/enums/scheduled-task-name.enum";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";

import { ActiveAlarm } from "./abstractions/browser-task-scheduler.service";
import { BrowserTaskSchedulerService } from "./browser-task-scheduler.service";

let activeAlarms: ActiveAlarm[] = [];
jest.mock("rxjs", () => ({
  firstValueFrom: jest.fn(() => Promise.resolve(activeAlarms)),
  map: jest.fn(),
  Observable: jest.fn(),
}));

// TODO CG - Likely need to rethink how to test this service a bit more carefully.
describe("BrowserTaskSchedulerService", () => {
  let logService: MockProxy<ConsoleLogService>;
  let stateProvider: MockProxy<StateProvider>;
  let browserTaskSchedulerService: BrowserTaskSchedulerService;
  const eventUploadsIntervalCreateInfo = { periodInMinutes: 5, delayInMinutes: 5 };
  const scheduleNextSyncIntervalCreateInfo = { periodInMinutes: 5, delayInMinutes: 5 };

  beforeEach(() => {
    jest.useFakeTimers();
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
          update: jest.fn((callback) => callback([], {} as any)),
        }),
      ),
    });
    browserTaskSchedulerService = new BrowserTaskSchedulerService(logService, stateProvider);
    jest.spyOn(browserTaskSchedulerService as any, "getAlarm").mockImplementation((alarmName) => {
      if (alarmName === ScheduledTaskNames.scheduleNextSyncInterval) {
        return Promise.resolve(mock<chrome.alarms.Alarm>({ name: alarmName }));
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    // eslint-disable-next-line
    // @ts-ignore
    globalThis.browser = {};
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
      jest.spyOn(browserTaskSchedulerService as any, "getAlarm").mockResolvedValue(
        mock<chrome.alarms.Alarm>({
          name: ScheduledTaskNames.loginStrategySessionTimeout,
        }),
      );
      jest.spyOn(browserTaskSchedulerService, "createAlarm");

      await browserTaskSchedulerService.setTimeout(
        callback,
        delayInMinutes * 60 * 1000,
        ScheduledTaskNames.loginStrategySessionTimeout,
      );

      expect(browserTaskSchedulerService.createAlarm).not.toHaveBeenCalled();
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

  describe("clearScheduledTask", () => {
    afterEach(() => {
      chrome.alarms.clear = jest.fn().mockImplementation((_name, callback) => callback(true));
    });

    it("skips clearing the alarm if the alarm name is not provided", async () => {
      await browserTaskSchedulerService.clearScheduledTask({
        timeoutId: 1,
        intervalId: 2,
      });

      expect(chrome.alarms.clear).not.toHaveBeenCalled();
    });

    it("skips deleting the active alarm if the alarm was not cleared", async () => {
      const taskIdentifier: TaskIdentifier = { taskName: ScheduledTaskNames.eventUploadsInterval };
      chrome.alarms.clear = jest.fn().mockImplementation((_name, callback) => callback(false));
      jest.spyOn(browserTaskSchedulerService as any, "deleteActiveAlarm");

      await browserTaskSchedulerService.clearScheduledTask(taskIdentifier);

      expect(browserTaskSchedulerService["deleteActiveAlarm"]).not.toHaveBeenCalled();
    });

    it("clears a named alarm", async () => {
      const taskIdentifier: TaskIdentifier = { taskName: ScheduledTaskNames.eventUploadsInterval };
      jest.spyOn(browserTaskSchedulerService as any, "deleteActiveAlarm");

      await browserTaskSchedulerService.clearScheduledTask(taskIdentifier);

      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        ScheduledTaskNames.eventUploadsInterval,
        expect.any(Function),
      );
      expect(browserTaskSchedulerService["deleteActiveAlarm"]).toHaveBeenCalledWith(
        ScheduledTaskNames.eventUploadsInterval,
      );
    });
  });

  describe("clearAllScheduledTasks", () => {
    it("clears all scheduled tasks and extension alarms", async () => {
      jest.spyOn(browserTaskSchedulerService, "clearAllAlarms");
      jest.spyOn(browserTaskSchedulerService as any, "updateActiveAlarms");

      await browserTaskSchedulerService.clearAllScheduledTasks();

      expect(browserTaskSchedulerService.clearAllAlarms).toHaveBeenCalled();
      expect(browserTaskSchedulerService["updateActiveAlarms"]).toHaveBeenCalledWith([]);
      expect(browserTaskSchedulerService["onAlarmHandlers"]).toEqual({});
      expect(browserTaskSchedulerService["recoveredAlarms"].size).toBe(0);
    });
  });

  describe("handleOnAlarm", () => {
    it("triggers the alarm", async () => {
      const alarm = mock<chrome.alarms.Alarm>({ name: ScheduledTaskNames.eventUploadsInterval });
      const callback = jest.fn();
      browserTaskSchedulerService["onAlarmHandlers"][alarm.name] = callback;

      await browserTaskSchedulerService["handleOnAlarm"](alarm);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("clearAlarm", () => {
    it("uses the browser.alarms API if it is available", async () => {
      const alarmName = "alarm-name";
      globalThis.browser = {
        // eslint-disable-next-line
        // @ts-ignore
        alarms: {
          clear: jest.fn(),
        },
      };

      await browserTaskSchedulerService.clearAlarm(alarmName);

      expect(browser.alarms.clear).toHaveBeenCalledWith(alarmName);
    });

    it("clears the alarm with the provided name", async () => {
      const alarmName = "alarm-name";

      const wasCleared = await browserTaskSchedulerService.clearAlarm(alarmName);

      expect(chrome.alarms.clear).toHaveBeenCalledWith(alarmName, expect.any(Function));
      expect(wasCleared).toBe(true);
    });
  });

  describe("clearAllAlarms", () => {
    it("uses the browser.alarms API if it is available", async () => {
      globalThis.browser = {
        // eslint-disable-next-line
        // @ts-ignore
        alarms: {
          clearAll: jest.fn(),
        },
      };

      await browserTaskSchedulerService.clearAllAlarms();

      expect(browser.alarms.clearAll).toHaveBeenCalled();
    });

    it("clears all alarms", async () => {
      const wasCleared = await browserTaskSchedulerService.clearAllAlarms();

      expect(chrome.alarms.clearAll).toHaveBeenCalledWith(expect.any(Function));
      expect(wasCleared).toBe(true);
    });
  });

  describe("createAlarm", () => {
    it("uses the browser.alarms API if it is available", async () => {
      const alarmName = "alarm-name";
      const alarmInfo = { when: 1000 };
      globalThis.browser = {
        // eslint-disable-next-line
        // @ts-ignore
        alarms: {
          create: jest.fn(),
        },
      };

      await browserTaskSchedulerService.createAlarm(alarmName, alarmInfo);

      expect(browser.alarms.create).toHaveBeenCalledWith(alarmName, alarmInfo);
    });

    it("creates an alarm", async () => {
      const alarmName = "alarm-name";
      const alarmInfo = { when: 1000 };

      await browserTaskSchedulerService.createAlarm(alarmName, alarmInfo);

      expect(chrome.alarms.create).toHaveBeenCalledWith(alarmName, alarmInfo, expect.any(Function));
    });
  });

  describe.skip("getAlarm", () => {
    it("uses the browser.alarms API if it is available", async () => {
      const alarmName = "alarm-name";
      globalThis.browser = {
        // eslint-disable-next-line
        // @ts-ignore
        alarms: {
          get: jest.fn(),
        },
      };

      await browserTaskSchedulerService.getAlarm(alarmName);

      expect(browser.alarms.get).toHaveBeenCalledWith(alarmName);
    });

    it("gets the alarm by name", async () => {
      const alarmName = "alarm-name";
      const alarmMock = mock<chrome.alarms.Alarm>();
      chrome.alarms.get = jest.fn().mockImplementation((_name, callback) => callback(alarmMock));

      const receivedAlarm = await browserTaskSchedulerService.getAlarm(alarmName);

      expect(chrome.alarms.get).toHaveBeenCalledWith(alarmName, expect.any(Function));
      expect(receivedAlarm).toBe(alarmMock);
    });
  });

  describe("getAllAlarms", () => {
    it("uses the browser.alarms API if it is available", async () => {
      globalThis.browser = {
        // eslint-disable-next-line
        // @ts-ignore
        alarms: {
          getAll: jest.fn(),
        },
      };

      await browserTaskSchedulerService.getAllAlarms();

      expect(browser.alarms.getAll).toHaveBeenCalled();
    });

    it("gets all registered alarms", async () => {
      const alarms = [mock<chrome.alarms.Alarm>(), mock<chrome.alarms.Alarm>()];
      chrome.alarms.getAll = jest.fn().mockImplementation((callback) => callback(alarms));

      const receivedAlarms = await browserTaskSchedulerService.getAllAlarms();

      expect(chrome.alarms.getAll).toHaveBeenCalledWith(expect.any(Function));
      expect(receivedAlarms).toBe(alarms);
    });
  });
});
