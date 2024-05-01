import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable } from "rxjs";

import { ScheduledTaskNames } from "@bitwarden/common/platform/enums/scheduled-task-name.enum";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { flushPromises } from "../../autofill/spec/testing-utils";

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
  return `${userUuid}__${taskName}`;
}

describe("BrowserTaskSchedulerService", () => {
  const callback = jest.fn();
  const delayInMinutes = 2;
  let activeUserIdMock$: BehaviorSubject<UserId>;
  let activeAlarmsMock$: BehaviorSubject<ActiveAlarm[]>;
  let logService: MockProxy<ConsoleLogService>;
  let stateProvider: MockProxy<StateProvider>;
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
    stateProvider = mock<StateProvider>({
      activeUserId$: activeUserIdMock$,
      getGlobal: jest.fn(() =>
        mock<GlobalState<any>>({
          state$: mock<Observable<any>>(),
          update: jest.fn((callback) => callback([], {} as any)),
        }),
      ),
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
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    // eslint-disable-next-line no-global-assign
    globalThis.browser = undefined;
  });

  describe("setTimeout", () => {
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
  });
});
