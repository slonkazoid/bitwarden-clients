import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { UserId } from "../../../../common/src/types/guid";
import { LogService } from "../abstractions/log.service";
import { ScheduledTaskNames } from "../enums/scheduled-task-name.enum";
import { StateProvider } from "../state";

import { DefaultTaskSchedulerService } from "./default-task-scheduler.service";

describe("TaskSchedulerService", () => {
  const callback = jest.fn();
  const delayInMs = 1000;
  const intervalInMs = 1100;
  let activeUserIdMock$: BehaviorSubject<UserId>;
  let logService: MockProxy<LogService>;
  let stateProvider: MockProxy<StateProvider>;
  let taskSchedulerService: DefaultTaskSchedulerService;

  beforeEach(() => {
    jest.useFakeTimers();
    activeUserIdMock$ = new BehaviorSubject<UserId>("user-uuid" as UserId);
    logService = mock<LogService>();
    stateProvider = mock<StateProvider>({
      activeUserId$: activeUserIdMock$,
    });
    taskSchedulerService = new DefaultTaskSchedulerService(logService, stateProvider);
    void taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.loginStrategySessionTimeout,
      callback,
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  it("sets a timeout and returns the timeout id", async () => {
    const timeoutId = await taskSchedulerService.setTimeout(
      ScheduledTaskNames.loginStrategySessionTimeout,
      delayInMs,
    );

    expect(timeoutId).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(delayInMs);

    expect(callback).toHaveBeenCalled();
  });

  it("sets an interval timeout and results the interval id", async () => {
    const intervalId = await taskSchedulerService.setInterval(
      ScheduledTaskNames.loginStrategySessionTimeout,
      intervalInMs,
    );

    expect(intervalId).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(intervalInMs);

    expect(callback).toHaveBeenCalled();

    jest.advanceTimersByTime(intervalInMs);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("clears scheduled tasks using the timeout id", async () => {
    const timeoutId = await taskSchedulerService.setTimeout(
      ScheduledTaskNames.loginStrategySessionTimeout,
      delayInMs,
    );

    expect(timeoutId).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    await taskSchedulerService.clearScheduledTask({ timeoutId });

    jest.advanceTimersByTime(delayInMs);

    expect(callback).not.toHaveBeenCalled();
  });

  it("clears scheduled tasks using the interval id", async () => {
    const intervalId = await taskSchedulerService.setInterval(
      ScheduledTaskNames.loginStrategySessionTimeout,
      intervalInMs,
    );

    expect(intervalId).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    await taskSchedulerService.clearScheduledTask({ intervalId });

    jest.advanceTimersByTime(intervalInMs);

    expect(callback).not.toHaveBeenCalled();
  });
});
