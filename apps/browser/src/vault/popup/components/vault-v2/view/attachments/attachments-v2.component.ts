import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SearchModule, ButtonModule, ToastService } from "@bitwarden/components";

import { PasswordRepromptService } from "../../../../../../../../../libs/vault/src/services/password-reprompt.service";

@Component({
  selector: "app-attachments-v2",
  templateUrl: "attachments-v2.component.html",
  standalone: true,
  imports: [CommonModule, SearchModule, JslibModule, FormsModule, ButtonModule],
})
export class AttachmentsV2Component {
  @Input() cipher: CipherView;

  private passwordReprompted = false;
  canAccessPremium: boolean;

  constructor(
    protected passwordRepromptService: PasswordRepromptService,
    protected i18nService: I18nService,
    protected apiService: ApiService,
    protected fileDownloadService: FileDownloadService,
    protected cryptoService: CryptoService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private toastService: ToastService,
  ) {
    this.subscribeToHasPremiumCheck();
  }

  subscribeToHasPremiumCheck() {
    this.billingAccountProfileStateService.hasPremiumFromAnySource$
      .pipe(takeUntilDestroyed())
      .subscribe((data) => {
        this.canAccessPremium = data;
      });
  }

  protected async promptPassword() {
    if (this.cipher.reprompt === CipherRepromptType.None || this.passwordReprompted) {
      return true;
    }

    return (this.passwordReprompted = await this.passwordRepromptService.showPasswordPrompt());
  }

  async downloadAttachment(attachment: any) {
    if (!(await this.promptPassword())) {
      return;
    }
    const a = attachment as any;

    if (a.downloading) {
      return;
    }

    if (this.cipher.organizationId == null && !this.canAccessPremium) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("premiumRequired"),
        message: this.i18nService.t("premiumRequiredDesc"),
      });
      return;
    }

    let url: string;
    try {
      const attachmentDownloadResponse = await this.apiService.getAttachmentData(
        this.cipher.id,
        attachment.id,
      );
      url = attachmentDownloadResponse.url;
    } catch (e) {
      if (e instanceof ErrorResponse && (e as ErrorResponse).statusCode === 404) {
        url = attachment.url;
      } else if (e instanceof ErrorResponse) {
        throw new Error((e as ErrorResponse).getSingleMessage());
      } else {
        throw e;
      }
    }

    a.downloading = true;
    const response = await fetch(new Request(url, { cache: "no-store" }));
    if (response.status !== 200) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
      a.downloading = false;
      return;
    }

    try {
      const encBuf = await EncArrayBuffer.fromResponse(response);
      const key =
        attachment.key != null
          ? attachment.key
          : await this.cryptoService.getOrgKey(this.cipher.organizationId);
      const decBuf = await this.cryptoService.decryptFromBytes(encBuf, key);
      this.fileDownloadService.download({
        fileName: attachment.fileName,
        blobData: decBuf,
      });
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
    }

    a.downloading = false;
  }
}
