import { firstValueFrom } from "rxjs";

import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { ScheduledTaskNames } from "@bitwarden/common/platform/enums/scheduled-task-name.enum";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";

import { BrowserTaskSchedulerService } from "../../platform/services/abstractions/browser-task-scheduler.service";

import { ClearClipboard } from "./clear-clipboard";
import { copyToClipboard } from "./copy-to-clipboard-command";

export class GeneratePasswordToClipboardCommand {
  private clearClipboardTimeout: number | NodeJS.Timeout;

  constructor(
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private taskSchedulerService: BrowserTaskSchedulerService,
  ) {}

  async getClearClipboard() {
    return await firstValueFrom(this.autofillSettingsService.clearClipboardDelay$);
  }

  async generatePasswordToClipboard(tab: chrome.tabs.Tab) {
    const [options] = await this.passwordGenerationService.getOptions();
    const password = await this.passwordGenerationService.generatePassword(options);

    await copyToClipboard(tab, password);

    const clearClipboardDelayInSeconds = await this.getClearClipboard();
    if (!clearClipboardDelayInSeconds) {
      return;
    }

    const timeoutInMs = clearClipboardDelayInSeconds * 1000;
    await this.taskSchedulerService.clearScheduledTask({
      taskName: ScheduledTaskNames.clearClipboardTimeout,
      timeoutId: this.clearClipboardTimeout,
    });
    await this.taskSchedulerService.setTimeout(
      () => ClearClipboard.run(),
      timeoutInMs,
      ScheduledTaskNames.clearClipboardTimeout,
    );
  }
}
