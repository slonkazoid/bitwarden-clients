import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, firstValueFrom, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { SearchModule, ButtonModule } from "@bitwarden/components";

import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

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
  ],
})
export class ViewV2Component implements OnDestroy {
  headerText: string;
  cipherId: string;
  cipher: CipherView;
  organization: Organization;
  cipherCollections: CollectionView[];
  folder: FolderView;
  private destroyed$: Subject<void> = new Subject();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private i18nService: I18nService,
    private cipherService: CipherService,
    private organizationService: OrganizationService,
    private collectionService: CollectionService,
    private folderService: FolderService,
  ) {
    this.subscribeToParams();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  subscribeToParams(): void {
    // eslint-disable-next-line rxjs/no-async-subscribe
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe(async (params) => {
      const cipherType = parseInt(params.type);
      this.cipherId = params.cipherId;

      this.headerText = this.setHeader(cipherType);
      await this.loadCipherData();
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

  async loadCipherData() {
    const cipher = await this.cipherService.get(this.cipherId);
    this.cipher = await cipher.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipher),
    );

    if (this.cipher.collectionIds.length > 0) {
      const allCollections = await this.collectionService.getAllDecrypted();

      this.cipherCollections = allCollections.filter((collection) => {
        if (this.cipher.collectionIds.includes(collection.id)) {
          return collection;
        }
      });
    }

    if (this.cipher.organizationId) {
      this.organizationService
        .get$(this.cipher.organizationId)
        .pipe(takeUntil(this.destroyed$))
        .subscribe((org) => {
          this.organization = org;
        });
    }

    if (this.cipher.folderId) {
      if (this.cipher.folderId) {
        this.folder = await (
          await firstValueFrom(this.folderService.folderViews$)
        ).find((f) => f.id == this.cipher.folderId);
      }
    }
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

  openPasswordHistory() {}
}
