import { Directive, HostListener, Input } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { ToastVariant } from "@bitwarden/components/src/toast/toast.component";

@Directive({
  selector: "[appCopyClick]",
})
export class CopyClickDirective {
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
  ) {}

  @Input("appCopyClick") valueToCopy = "";
  @Input("appCopyToastMessage") toastMessage?: string;
  @Input("appCopyToastVariant") toastVariant?: ToastVariant;

  @HostListener("click") onClick() {
    this.platformUtilsService.copyToClipboard(this.valueToCopy);
    if (this.toastMessage && this.toastVariant) {
      this.toastService.showToast({
        variant: this.toastVariant,
        title: null,
        message: this.toastMessage,
      });
    }
  }
}
