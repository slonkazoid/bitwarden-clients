import { BrowserTaskSchedulerServiceImplementation } from "../../services/task-scheduler/browser-task-scheduler.service";

import { CachedServices, factory, FactoryOptions } from "./factory-options";
import { logServiceFactory, LogServiceInitOptions } from "./log-service.factory";
import { stateProviderFactory, StateProviderInitOptions } from "./state-provider.factory";

type TaskSchedulerServiceFactoryOptions = FactoryOptions;

export type TaskSchedulerServiceInitOptions = TaskSchedulerServiceFactoryOptions &
  LogServiceInitOptions &
  StateProviderInitOptions;

export function taskSchedulerServiceFactory(
  cache: {
    browserTaskSchedulerService?: BrowserTaskSchedulerServiceImplementation;
  } & CachedServices,
  opts: TaskSchedulerServiceInitOptions,
): Promise<BrowserTaskSchedulerServiceImplementation> {
  return factory(
    cache,
    "browserTaskSchedulerService",
    opts,
    async () =>
      new BrowserTaskSchedulerServiceImplementation(
        await logServiceFactory(cache, opts),
        await stateProviderFactory(cache, opts),
      ),
  );
}
