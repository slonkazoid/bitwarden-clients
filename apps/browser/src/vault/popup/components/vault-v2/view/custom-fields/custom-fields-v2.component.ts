import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { FieldType } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { SearchModule, ButtonModule, ToastService, CardComponent } from "@bitwarden/components";

@Component({
  selector: "app-custom-fields-v2",
  templateUrl: "custom-fields-v2.component.html",
  standalone: true,
  imports: [CommonModule, SearchModule, JslibModule, FormsModule, ButtonModule, CardComponent],
})
export class CustomFieldV2Component implements OnInit {
  @Input() fields: FieldView[];
  hiddenFields: any = {};
  fieldType = FieldType;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  ngOnInit() {
    this.saveHiddenFieldsVisibility();
  }

  // keeping a log of hidden fields so we can toggle show/hide only on values selected
  saveHiddenFieldsVisibility() {
    if (this.fields.length > 0) {
      this.fields.forEach((field) => {
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
    this.toastService.showToast({
      variant: "info",
      title: null,
      message: this.i18nService.t("copySuccessful"),
    });
  }

  togglePassword(name: string) {
    this.hiddenFields[name] = !this.hiddenFields[name];
  }
}
