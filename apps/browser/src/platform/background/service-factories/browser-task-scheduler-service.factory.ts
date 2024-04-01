import { BrowserTaskSchedulerService } from "../../services/browser-task-scheduler.service";

import { CachedServices, factory, FactoryOptions } from "./factory-options";
import { logServiceFactory, LogServiceInitOptions } from "./log-service.factory";
import { stateProviderFactory, StateProviderInitOptions } from "./state-provider.factory";

type BrowserTaskSchedulerServiceFactoryOptions = FactoryOptions;

export type BrowserTaskSchedulerServiceInitOptions = BrowserTaskSchedulerServiceFactoryOptions &
  LogServiceInitOptions &
  StateProviderInitOptions;

export function browserTaskSchedulerServiceFactory(
  cache: { browserTaskSchedulerService?: BrowserTaskSchedulerService } & CachedServices,
  opts: BrowserTaskSchedulerServiceInitOptions,
): Promise<BrowserTaskSchedulerService> {
  return factory(
    cache,
    "browserTaskSchedulerService",
    opts,
    async () =>
      new BrowserTaskSchedulerService(
        await logServiceFactory(cache, opts),
        await stateProviderFactory(cache, opts),
      ),
  );
}
