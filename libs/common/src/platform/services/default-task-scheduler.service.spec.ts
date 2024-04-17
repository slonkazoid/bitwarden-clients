import { DefaultTaskSchedulerService } from "./default-task-scheduler.service";

describe("TaskSchedulerService", () => {
  const callback = jest.fn();
  const delayInMs = 1000;
  const intervalInMs = 1100;
  let taskSchedulerService: DefaultTaskSchedulerService;

  beforeEach(() => {
    jest.useFakeTimers();
    taskSchedulerService = new DefaultTaskSchedulerService();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  it("sets a timeout and returns the timeout id", async () => {
    const timeoutId = await taskSchedulerService.setTimeout(callback, delayInMs);

    expect(timeoutId).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(delayInMs);

    expect(callback).toHaveBeenCalled();
  });

  it("sets an interval timeout and results the interval id", async () => {
    const intervalId = await taskSchedulerService.setInterval(callback, intervalInMs);

    expect(intervalId).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(intervalInMs);

    expect(callback).toHaveBeenCalled();

    jest.advanceTimersByTime(intervalInMs);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("clears scheduled tasks using the timeout id", async () => {
    const timeoutId = await taskSchedulerService.setTimeout(callback, delayInMs);

    expect(timeoutId).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    await taskSchedulerService.clearScheduledTask({ timeoutId });

    jest.advanceTimersByTime(delayInMs);

    expect(callback).not.toHaveBeenCalled();
  });

  it("clears scheduled tasks using the interval id", async () => {
    const intervalId = await taskSchedulerService.setInterval(callback, intervalInMs);

    expect(intervalId).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    await taskSchedulerService.clearScheduledTask({ intervalId });

    jest.advanceTimersByTime(intervalInMs);

    expect(callback).not.toHaveBeenCalled();
  });
});
