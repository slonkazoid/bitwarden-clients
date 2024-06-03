import { CommonModule, Location } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Observable, first, map, take } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { Checkable } from "@bitwarden/common/types/checkable";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { ButtonModule, CardComponent, SelectModule, FormFieldModule } from "@bitwarden/components";

import { PopOutComponent } from "../../../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

@Component({
  standalone: true,
  selector: "app-assign-collections",
  templateUrl: "./assign-collections.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    SelectModule,
    FormsModule,
    FormFieldModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    PopOutComponent,
    CardComponent,
  ],
})
export class AssignCollections {
  /** All writeable collections */
  private writeableCollections: Checkable<CollectionView>[] = [];

  /** Available organizations to which the cipher can be assigned to */
  organizations$: Observable<Organization[]>;

  /** The selected organization Id */
  organizationId: string | null = null;

  /** Selectable collections */
  collections: Checkable<CollectionView>[] = [];

  /** The current cipher being altered */
  cipher: CipherView;

  constructor(
    private location: Location,
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
    private i18nService: I18nService,
    private cipherService: CipherService,
    route: ActivatedRoute,
  ) {
    // eslint-disable-next-line rxjs/no-async-subscribe
    route.queryParams.pipe(takeUntilDestroyed(), first()).subscribe(async ({ cipherId }) => {
      const cipherDomain = await this.cipherService.get(cipherId);
      this.cipher = await cipherDomain.decrypt(
        await this.cipherService.getKeyForCipherKeyDecryption(cipherDomain),
      );
    });

    this.collectionService.decryptedCollections$
      .pipe(takeUntilDestroyed(), take(1))
      .subscribe((collections) => {
        this.writeableCollections = collections.filter((c) => !c.readOnly);
      });

    this.organizations$ = this.organizationService.memberOrganizations$.pipe(
      map((orgs) => {
        return orgs
          .filter((o) => o.enabled && o.status === OrganizationUserStatusType.Confirmed)
          .sort(Utils.getSortFunction(this.i18nService, "name"));
      }),
    );

    this.organizations$.pipe(takeUntilDestroyed()).subscribe((orgs) => {
      // When organizations are loaded & an organization hasn't been selected yet:
      // - Set the first organization as the selected organization
      // - Updated the collections based on the selected organization
      if (this.organizationId === null && orgs.length > 0) {
        this.organizationId = orgs[0].id;
        this.updateCollections();
      }
    });
  }

  /** Populate the selectable collections based on the organization selected */
  updateCollections() {
    this.writeableCollections.forEach((c) => (c.checked = false));
    if (this.organizationId === null || this.writeableCollections.length === 0) {
      this.collections = [];
    } else {
      this.collections = this.writeableCollections.filter(
        (c) => c.organizationId === this.organizationId,
      );
    }
  }

  /** Navigates the user back to the previous screen */
  navigateBack() {
    this.location.back();
  }
}
