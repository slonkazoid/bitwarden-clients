import { mock, MockProxy } from "jest-mock-extended";
import { Observable } from "rxjs";

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

describe("BrowserTaskSchedulerService", () => {
  let logService: MockProxy<ConsoleLogService>;
  let stateProvider: MockProxy<StateProvider>;
  let browserTaskSchedulerService: BrowserTaskSchedulerService;

  beforeEach(() => {
    activeAlarms = [];
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
      expect(chrome.alarms.create).not.toHaveBeenCalled();
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
      expect(chrome.alarms.create).not.toHaveBeenCalled();
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
      expect(chrome.alarms.create).not.toHaveBeenCalled();
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
