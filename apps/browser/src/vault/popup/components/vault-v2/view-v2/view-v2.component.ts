import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { SearchModule, ButtonModule, IconButtonModule } from "@bitwarden/components";

import { CipherViewComponent } from "../../../../../../../../libs/vault/src/cipher-view";

import { PopupFooterComponent } from "./../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "./../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "./../../../../../platform/popup/layout/popup-page.component";

@Component({
  selector: "app-view-v2",
  templateUrl: "view-v2.component.html",
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
    IconButtonModule,
    CipherViewComponent,
  ],
})
export class ViewV2Component {
  headerText: string;
  cipherId: string;
  cipher: CipherView;
  organization$: Observable<Organization>;
  folder$: Observable<FolderView>;
  collections$: Observable<CollectionView[]>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private i18nService: I18nService,
    private cipherService: CipherService,
  ) {
    this.subscribeToParams();
  }

  subscribeToParams(): void {
    // eslint-disable-next-line rxjs/no-async-subscribe
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe(async (params) => {
      this.cipherId = params.cipherId;
      await this.getCipherData();
    });
  }

  setHeader(type: CipherType) {
    switch (type) {
      case CipherType.Login:
        return this.i18nService.t("viewItemHeader", this.i18nService.t("typeLogin"));
      case CipherType.Card:
        return this.i18nService.t("viewItemHeader", this.i18nService.t("typeCard"));
      case CipherType.Identity:
        return this.i18nService.t("viewItemHeader", this.i18nService.t("typeIdentity"));
      case CipherType.SecureNote:
        return this.i18nService.t("viewItemHeader", this.i18nService.t("note"));
    }
  }

  async getCipherData() {
    const cipher = await this.cipherService.get(this.cipherId);
    this.cipher = await cipher.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipher),
    );

    this.headerText = this.setHeader(this.cipher.type);
  }

  editCipher() {
    if (this.cipher.isDeleted) {
      return false;
    }
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/edit-cipher"], {
      queryParams: { cipherId: this.cipher.id, type: this.cipher.type, isNew: false },
    });
    return true;
  }

  deleteCipher() {}
}
