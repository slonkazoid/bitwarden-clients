import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Subscription, first } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { SearchModule, ButtonModule } from "@bitwarden/components";

import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

@Component({
  selector: "app-add-edit-v2",
  templateUrl: "add-edit-v2.component.html",
  standalone: true,
  imports: [
    CommonModule,
    SearchModule,
    JslibModule,
    FormsModule,
    ButtonModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
  ],
})
export class AddEditV2Component {
  headerText: string;

  constructor(
    private route: ActivatedRoute,
    private i18nService: I18nService,
  ) {
    this.subscribeToParams();
  }

  subscribeToParams(): Subscription {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    return this.route.queryParams.pipe(first()).subscribe((params) => {
      const isNew = params.isNew.toLowerCase() === "true";
      const cipherType = parseInt(params.type);

      this.headerText = this.setHeader(isNew, cipherType);
    });
  }

  setHeader(isNew: boolean, type: CipherType) {
    const headerOne = isNew ? this.i18nService.t("new") : this.i18nService.t("view");
    let headerTwo;

    switch (type) {
      case CipherType.Login:
        headerTwo = this.i18nService.t("typeLogin");
        break;
      case CipherType.Card:
        headerTwo = this.i18nService.t("typeCard");
        break;
      case CipherType.Identity:
        headerTwo = this.i18nService.t("typeIdentity");
        break;
      case CipherType.SecureNote:
        headerTwo = this.i18nService.t("note");
        break;
    }

    return `${headerOne} ${headerTwo}`;
  }
}
