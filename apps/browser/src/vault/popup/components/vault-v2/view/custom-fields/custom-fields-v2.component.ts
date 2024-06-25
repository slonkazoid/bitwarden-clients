import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FieldType, LinkedIdType, LoginLinkedId } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import { CardComponent, IconButtonModule } from "@bitwarden/components";

type HiddenFieldMap = {
  [key: string]: boolean;
};

@Component({
  selector: "app-custom-fields-v2",
  templateUrl: "custom-fields-v2.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, CardComponent, IconButtonModule],
})
export class CustomFieldV2Component implements OnInit {
  @Input() fields: FieldView[];
  hiddenFields: HiddenFieldMap;
  fieldType = FieldType;

  constructor(private i18nService: I18nService) {}

  ngOnInit() {
    this.saveHiddenFieldsVisibility();
  }

  saveHiddenFieldsVisibility() {
    if (this.fields.length > 0) {
      this.hiddenFields = {};
      this.fields.forEach((field: FieldView) => {
        if (field.type === this.fieldType.Hidden) {
          this.hiddenFields[field.name] = false;
        }
      });
    }
  }

  getLinkedType(linkedId: LinkedIdType) {
    if (linkedId === LoginLinkedId.Username) {
      return this.i18nService.t("username");
    }

    if (linkedId === LoginLinkedId.Password) {
      return this.i18nService.t("password");
    }
  }

  togglePassword(name: string) {
    this.hiddenFields[name] = !this.hiddenFields[name];
  }
}
