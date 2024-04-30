import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable } from "rxjs";

import { ScheduledTaskNames } from "@bitwarden/common/platform/enums/scheduled-task-name.enum";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

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

describe("BrowserTaskSchedulerService", () => {
  const callback = jest.fn();
  const delayInMinutes = 2;
  const userUuid = "user-uuid" as UserId;
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
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe("setTimeout", () => {
    it("uses the global setTimeout API if the delay is less than 1000ms", async () => {
      const delayInMs = 999;
      jest.spyOn(globalThis, "setTimeout");

      await browserTaskSchedulerService.setTimeout(
        ScheduledTaskNames.loginStrategySessionTimeout,
        delayInMs,
      );

      expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), delayInMs);
      expect(chrome.alarms.create).not.toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { delayInMinutes: 1 },
        expect.any(Function),
      );
    });

    it("creates a timeout alarm", async () => {
      await browserTaskSchedulerService.setTimeout(
        ScheduledTaskNames.loginStrategySessionTimeout,
        delayInMinutes * 60 * 1000,
      );

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        `${userUuid}__${ScheduledTaskNames.loginStrategySessionTimeout}`,
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
  });
});
