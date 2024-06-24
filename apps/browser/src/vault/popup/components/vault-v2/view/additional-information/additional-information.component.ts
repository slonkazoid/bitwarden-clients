import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SearchModule, ButtonModule, CardComponent, ToastService } from "@bitwarden/components";

@Component({
  selector: "app-additional-information",
  templateUrl: "additional-information.component.html",
  standalone: true,
  imports: [CommonModule, SearchModule, JslibModule, FormsModule, ButtonModule, CardComponent],
})
export class AdditionalInformationComponent {
  @Input() notes: string;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  copy(textData: string) {
    this.platformUtilsService.copyToClipboard(textData, null);
    this.toastService.showToast({
      variant: "info",
      title: null,
      message: this.i18nService.t("copySuccessful"),
    });
  }
}
