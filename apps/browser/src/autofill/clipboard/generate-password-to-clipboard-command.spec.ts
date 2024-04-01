import { mock, MockProxy } from "jest-mock-extended";

import { AutofillSettingsService } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { ScheduledTaskNames } from "@bitwarden/common/platform/enums/scheduled-task-name.enum";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";

import { BrowserApi } from "../../platform/browser/browser-api";
import { BrowserTaskSchedulerService } from "../../platform/services/browser-task-scheduler.service";

import { GeneratePasswordToClipboardCommand } from "./generate-password-to-clipboard-command";

describe("GeneratePasswordToClipboardCommand", () => {
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let autofillSettingsService: MockProxy<AutofillSettingsService>;
  let browserTaskSchedulerService: MockProxy<BrowserTaskSchedulerService>;

  let sut: GeneratePasswordToClipboardCommand;

  beforeEach(() => {
    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    browserTaskSchedulerService = mock<BrowserTaskSchedulerService>();

    passwordGenerationService.getOptions.mockResolvedValue([{ length: 8 }, {} as any]);

    passwordGenerationService.generatePassword.mockResolvedValue("PASSWORD");

    jest.spyOn(BrowserApi, "sendTabsMessage").mockReturnValue();

    sut = new GeneratePasswordToClipboardCommand(
      passwordGenerationService,
      autofillSettingsService,
      browserTaskSchedulerService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("generatePasswordToClipboard", () => {
    it("has clear clipboard value", async () => {
      jest.spyOn(sut as any, "getClearClipboard").mockImplementation(() => 5 * 60); // 5 minutes

      await sut.generatePasswordToClipboard({ id: 1 } as any);

      expect(jest.spyOn(BrowserApi, "sendTabsMessage")).toHaveBeenCalledTimes(1);

      expect(jest.spyOn(BrowserApi, "sendTabsMessage")).toHaveBeenCalledWith(1, {
        command: "copyText",
        text: "PASSWORD",
      });

      expect(browserTaskSchedulerService.setTimeout).toHaveBeenCalledTimes(1);
      expect(browserTaskSchedulerService.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Number),
        ScheduledTaskNames.clearClipboardTimeout,
      );
    });

    it("does not have clear clipboard value", async () => {
      jest.spyOn(sut as any, "getClearClipboard").mockImplementation(() => null);

      await sut.generatePasswordToClipboard({ id: 1 } as any);

      expect(jest.spyOn(BrowserApi, "sendTabsMessage")).toHaveBeenCalledTimes(1);

      expect(jest.spyOn(BrowserApi, "sendTabsMessage")).toHaveBeenCalledWith(1, {
        command: "copyText",
        text: "PASSWORD",
      });
      expect(browserTaskSchedulerService.setTimeout).not.toHaveBeenCalled();
    });
  });
});
