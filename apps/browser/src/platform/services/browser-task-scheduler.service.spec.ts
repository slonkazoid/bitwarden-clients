import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable } from "rxjs";

import { ScheduledTaskNames } from "@bitwarden/common/platform/enums/scheduled-task-name.enum";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { flushPromises, triggerOnAlarmEvent } from "../../autofill/spec/testing-utils";

import {
  ActiveAlarm,
  BrowserTaskSchedulerService,
} from "./abstractions/browser-task-scheduler.service";
import { BrowserTaskSchedulerServiceImplementation } from "./browser-task-scheduler.service";

jest.mock("rxjs", () => {
  const actualModule = jest.requireActual("rxjs");
  return {
    ...actualModule,
    firstValueFrom: jest.fn((state$: BehaviorSubject<any>) => state$.value),
  };
});

function setupGlobalBrowserMock(overrides: Partial<chrome.alarms.Alarm> = {}) {
  globalThis.browser.alarms = {
    create: jest.fn(),
    clear: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    clearAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    ...overrides,
  };
}
const userUuid = "user-uuid" as UserId;
function getAlarmNameMock(taskName: string) {
  return `${taskName}__${userUuid}`;
}

describe("BrowserTaskSchedulerService", () => {
  const callback = jest.fn();
  const delayInMinutes = 2;
  let activeUserIdMock$: BehaviorSubject<UserId>;
  let activeAlarmsMock$: BehaviorSubject<ActiveAlarm[]>;
  let logService: MockProxy<ConsoleLogService>;
  let stateProvider: MockProxy<StateProvider>;
  let globalStateMock: MockProxy<GlobalState<any>>;
  let browserTaskSchedulerService: BrowserTaskSchedulerService;
  let activeAlarms: ActiveAlarm[] = [];
  const eventUploadsIntervalCreateInfo = { periodInMinutes: 5, delayInMinutes: 5 };
  const scheduleNextSyncIntervalCreateInfo = { periodInMinutes: 5, delayInMinutes: 5 };

  beforeEach(() => {
    jest.useFakeTimers();
    activeAlarms = [
      mock<ActiveAlarm>({
        alarmName: ScheduledTaskNames.eventUploadsInterval,
        createInfo: eventUploadsIntervalCreateInfo,
      }),
      mock<ActiveAlarm>({
        alarmName: ScheduledTaskNames.scheduleNextSyncInterval,
        createInfo: scheduleNextSyncIntervalCreateInfo,
      }),
      mock<ActiveAlarm>({
        alarmName: ScheduledTaskNames.fido2ClientAbortTimeout,
        startTime: Date.now() - 60001,
        createInfo: { delayInMinutes: 1, periodInMinutes: undefined },
      }),
    ];
    activeAlarmsMock$ = new BehaviorSubject(activeAlarms);
    activeUserIdMock$ = new BehaviorSubject(userUuid);
    logService = mock<ConsoleLogService>();
    globalStateMock = mock<GlobalState<any>>({
      state$: mock<Observable<any>>(),
      update: jest.fn((callback) => callback([], {} as any)),
    });
    stateProvider = mock<StateProvider>({
      activeUserId$: activeUserIdMock$,
      getGlobal: jest.fn(() => globalStateMock),
    });
    browserTaskSchedulerService = new BrowserTaskSchedulerServiceImplementation(
      logService,
      stateProvider,
    );
    browserTaskSchedulerService.activeAlarms$ = activeAlarmsMock$;
    browserTaskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.loginStrategySessionTimeout,
      callback,
    );
    // @ts-expect-error mocking global browser object
    // eslint-disable-next-line no-global-assign
    globalThis.browser = {};
    chrome.alarms.get = jest.fn().mockImplementation((_name, callback) => callback(undefined));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();

    // eslint-disable-next-line no-global-assign
    globalThis.browser = undefined;
  });

  describe("setTimeout", () => {
    it("triggers an error when setting a timeout for a task that is not registered", async () => {
      await expect(
        browserTaskSchedulerService.setTimeout(
          ScheduledTaskNames.notificationsReconnectTimeout,
          1000,
        ),
      ).rejects.toThrowError(
        `Task handler for ${ScheduledTaskNames.notificationsReconnectTimeout} not registered. Unable to schedule task.`,
      );
    });

    it("creates a timeout alarm", async () => {
      await browserTaskSchedulerService.setTimeout(
        ScheduledTaskNames.loginStrategySessionTimeout,
        delayInMinutes * 60 * 1000,
      );

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        getAlarmNameMock(ScheduledTaskNames.loginStrategySessionTimeout),
        { delayInMinutes },
        expect.any(Function),
      );
    });

    it("skips creating a duplicate timeout alarm", async () => {
      const mockAlarm = mock<chrome.alarms.Alarm>();
      chrome.alarms.get = jest.fn().mockImplementation((_name, callback) => callback(mockAlarm));

      await browserTaskSchedulerService.setTimeout(
        ScheduledTaskNames.loginStrategySessionTimeout,
        delayInMinutes * 60 * 1000,
      );

      expect(chrome.alarms.create).not.toHaveBeenCalled();
    });

    it("clears a scheduled alarm if a user-specific alarm for the same task is being registered", async () => {
      const mockAlarm = mock<chrome.alarms.Alarm>({
        name: ScheduledTaskNames.loginStrategySessionTimeout,
      });
      chrome.alarms.get = jest
        .fn()
        .mockImplementation((name, callback) =>
          callback(name === ScheduledTaskNames.loginStrategySessionTimeout ? mockAlarm : undefined),
        );

      await browserTaskSchedulerService.setTimeout(
        ScheduledTaskNames.loginStrategySessionTimeout,
        delayInMinutes * 60 * 1000,
      );

      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        expect.any(Function),
      );
    });

    it("creates an alarm that is not associated with a user", async () => {
      activeUserIdMock$.next(undefined);
      chrome.alarms.get = jest.fn().mockImplementation((_name, callback) => callback(undefined));

      await browserTaskSchedulerService.setTimeout(
        ScheduledTaskNames.loginStrategySessionTimeout,
        delayInMinutes * 60 * 1000,
      );

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { delayInMinutes },
        expect.any(Function),
      );
    });

    describe("when the task is scheduled to be triggered in less than 1 minute", () => {
      const delayInMs = 45000;

      it("sets a timeout using the global setTimeout API", async () => {
        jest.spyOn(globalThis, "setTimeout");

        await browserTaskSchedulerService.setTimeout(
          ScheduledTaskNames.loginStrategySessionTimeout,
          delayInMs,
        );

        expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), delayInMs);
      });

      it("sets a fallback alarm", async () => {
        const delayInMs = 15000;
        await browserTaskSchedulerService.setTimeout(
          ScheduledTaskNames.loginStrategySessionTimeout,
          delayInMs,
        );

        expect(chrome.alarms.create).toHaveBeenCalledWith(
          getAlarmNameMock(ScheduledTaskNames.loginStrategySessionTimeout),
          { delayInMinutes: 0.5 },
          expect.any(Function),
        );
      });

      it("sets the fallback for a minimum of 1 minute if the environment not for Chrome", async () => {
        setupGlobalBrowserMock();

        await browserTaskSchedulerService.setTimeout(
          ScheduledTaskNames.loginStrategySessionTimeout,
          delayInMs,
        );

        expect(browser.alarms.create).toHaveBeenCalledWith(
          getAlarmNameMock(ScheduledTaskNames.loginStrategySessionTimeout),
          { delayInMinutes: 1 },
        );
      });

      it("clears the fallback alarm when the setTimeout is triggered", async () => {
        jest.useFakeTimers();

        await browserTaskSchedulerService.setTimeout(
          ScheduledTaskNames.loginStrategySessionTimeout,
          delayInMs,
        );
        jest.advanceTimersByTime(delayInMs);
        await flushPromises();

        expect(chrome.alarms.clear).toHaveBeenCalledWith(
          getAlarmNameMock(ScheduledTaskNames.loginStrategySessionTimeout),
          expect.any(Function),
        );
      });
    });
  });

  describe("setInterval", () => {
    describe("setting an interval that is less than 1 minute", () => {
      const intervalInMs = 10000;

      it("sets up stepped alarms that trigger behavior after the first minute of setInterval execution", async () => {
        await browserTaskSchedulerService.setInterval(
          ScheduledTaskNames.loginStrategySessionTimeout,
          intervalInMs,
        );

        expect(chrome.alarms.create).toHaveBeenCalledWith(
          `${getAlarmNameMock(ScheduledTaskNames.loginStrategySessionTimeout)}__0`,
          { periodInMinutes: 0.5 },
          expect.any(Function),
        );
        expect(chrome.alarms.create).toHaveBeenCalledWith(
          `${getAlarmNameMock(ScheduledTaskNames.loginStrategySessionTimeout)}__1`,
          { periodInMinutes: 0.6666666666666666 },
          expect.any(Function),
        );
        expect(chrome.alarms.create).toHaveBeenCalledWith(
          `${getAlarmNameMock(ScheduledTaskNames.loginStrategySessionTimeout)}__2`,
          { periodInMinutes: 0.8333333333333333 },
          expect.any(Function),
        );
      });

      it("sets an interval using the global setInterval API", async () => {
        jest.spyOn(globalThis, "setInterval");

        await browserTaskSchedulerService.setInterval(
          ScheduledTaskNames.loginStrategySessionTimeout,
          intervalInMs,
        );

        expect(globalThis.setInterval).toHaveBeenCalledWith(expect.any(Function), intervalInMs);
      });

      it("clears the global setInterval instance once the interval has elapsed the minimum required delay for an alarm", async () => {
        jest.useFakeTimers();
        jest.spyOn(globalThis, "clearInterval");

        await browserTaskSchedulerService.setInterval(
          ScheduledTaskNames.loginStrategySessionTimeout,
          intervalInMs,
        );
        jest.advanceTimersByTime(50000);

        expect(globalThis.clearInterval).toHaveBeenCalledWith(expect.any(Number));
      });
    });

    it("creates an interval alarm", async () => {
      const periodInMinutes = 2;
      const initialDelayInMs = 1000;

      await browserTaskSchedulerService.setInterval(
        ScheduledTaskNames.loginStrategySessionTimeout,
        periodInMinutes * 60 * 1000,
        initialDelayInMs,
      );

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        getAlarmNameMock(ScheduledTaskNames.loginStrategySessionTimeout),
        { periodInMinutes, delayInMinutes: 0.5 },
        expect.any(Function),
      );
    });

    it("defaults the alarm's delay in minutes to the interval in minutes if the delay is not specified", async () => {
      const periodInMinutes = 2;
      await browserTaskSchedulerService.setInterval(
        ScheduledTaskNames.loginStrategySessionTimeout,
        periodInMinutes * 60 * 1000,
      );

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        getAlarmNameMock(ScheduledTaskNames.loginStrategySessionTimeout),
        { periodInMinutes, delayInMinutes: periodInMinutes },
        expect.any(Function),
      );
    });
  });

  describe("verifyAlarmsState", () => {
    it("skips recovering a scheduled task if an existing alarm for the task is present", async () => {
      chrome.alarms.get = jest
        .fn()
        .mockImplementation((_name, callback) => callback(mock<chrome.alarms.Alarm>()));

      await browserTaskSchedulerService.verifyAlarmsState();

      expect(chrome.alarms.create).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });

    describe("extension alarm is not set", () => {
      it("triggers the task when the task should have triggered", async () => {
        const fido2Callback = jest.fn();
        browserTaskSchedulerService.registerTaskHandler(
          ScheduledTaskNames.fido2ClientAbortTimeout,
          fido2Callback,
        );

        await browserTaskSchedulerService.verifyAlarmsState();

        expect(fido2Callback).toHaveBeenCalled();
      });

      it("schedules an alarm for the task when it has not yet triggered ", async () => {
        const syncCallback = jest.fn();
        browserTaskSchedulerService.registerTaskHandler(
          ScheduledTaskNames.scheduleNextSyncInterval,
          syncCallback,
        );

        await browserTaskSchedulerService.verifyAlarmsState();

        expect(chrome.alarms.create).toHaveBeenCalledWith(
          ScheduledTaskNames.scheduleNextSyncInterval,
          scheduleNextSyncIntervalCreateInfo,
          expect.any(Function),
        );
      });
    });
  });

  describe("triggering a task", () => {
    it("clears an non user-based alarm if a separate user-based alarm has been set up", async () => {
      jest.useFakeTimers();
      activeUserIdMock$.next(undefined);
      const delayInMs = 10000;
      chrome.alarms.get = jest
        .fn()
        .mockImplementation((_name, callback) => callback(mock<chrome.alarms.Alarm>()));

      await browserTaskSchedulerService.setTimeout(
        ScheduledTaskNames.loginStrategySessionTimeout,
        delayInMs,
      );
      jest.advanceTimersByTime(delayInMs);
      await flushPromises();

      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        expect.any(Function),
      );
    });

    it("triggers a task when an onAlarm event is triggered", () => {
      const alarm = mock<chrome.alarms.Alarm>({
        name: ScheduledTaskNames.loginStrategySessionTimeout,
      });

      triggerOnAlarmEvent(alarm);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("clearScheduledTask", () => {
    it("skips clearing an alarm if the task name is not passed", async () => {
      await browserTaskSchedulerService.clearScheduledTask({ timeoutId: 1 });

      expect(chrome.alarms.clear).not.toHaveBeenCalled();
    });

    it("clears the alarm associated with the task", async () => {
      await browserTaskSchedulerService.clearScheduledTask({
        taskName: ScheduledTaskNames.loginStrategySessionTimeout,
      });

      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        getAlarmNameMock(ScheduledTaskNames.loginStrategySessionTimeout),
        expect.any(Function),
      );
    });

    it("clears the alarm associated with the task when in a non-Chrome environment", async () => {
      setupGlobalBrowserMock();

      await browserTaskSchedulerService.clearScheduledTask({
        taskName: ScheduledTaskNames.loginStrategySessionTimeout,
      });

      expect(browser.alarms.clear).toHaveBeenCalledWith(
        getAlarmNameMock(ScheduledTaskNames.loginStrategySessionTimeout),
      );
    });
  });

  describe("clearAllScheduledTasks", () => {
    it("clears all scheduled tasks and extension alarms", async () => {
      // @ts-expect-error mocking global state update method
      globalStateMock.update = jest.fn((callback) => {
        const stateValue = callback([], {} as any);
        activeAlarmsMock$.next(stateValue);
        return stateValue;
      });

      await browserTaskSchedulerService.clearAllScheduledTasks();

      expect(chrome.alarms.clearAll).toHaveBeenCalled();
      expect(activeAlarmsMock$.value).toEqual([]);
    });

    it("clears all extension alarms within a non Chrome environment", async () => {
      setupGlobalBrowserMock();

      await browserTaskSchedulerService.clearAllScheduledTasks();

      expect(browser.alarms.clearAll).toHaveBeenCalled();
    });
  });
});
