import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { FieldType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SearchModule, ButtonModule } from "@bitwarden/components";

@Component({
  selector: "app-additional-information-v2",
  templateUrl: "additional-information-v2.component.html",
  standalone: true,
  imports: [CommonModule, SearchModule, JslibModule, FormsModule, ButtonModule],
})
export class AdditionalInformationV2Component implements OnInit {
  @Input() cipher: CipherView;
  hiddenFields: any = {};
  fieldType = FieldType;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
  ) {}

  ngOnInit() {
    this.saveHiddenFieldsVisibility();
  }

  saveHiddenFieldsVisibility() {
    if (this.cipher.fields.length > 0) {
      this.cipher.fields.forEach((field) => {
        if (field.type === 1) {
          this.hiddenFields[field.name] = false;
        }
      });
    }
  }

  getLinkedType(linkedId: any) {
    if (linkedId === 100) {
      return this.i18nService.t("username");
    }

    if (linkedId === 101) {
      return this.i18nService.t("password");
    }
  }

  copy(textData: string) {
    this.platformUtilsService.copyToClipboard(textData, null);
    this.platformUtilsService.showToast("info", null, "Copy Successful");
  }

  togglePassword(name: string) {
    this.hiddenFields[name] = !this.hiddenFields[name];
  }
}
