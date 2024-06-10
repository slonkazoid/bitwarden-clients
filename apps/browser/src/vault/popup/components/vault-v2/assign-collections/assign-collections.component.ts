import { CommonModule, Location } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Observable, combineLatest, first, firstValueFrom, map, switchMap, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import {
  ButtonModule,
  CardComponent,
  SelectModule,
  FormFieldModule,
  SelectItemView,
  ToastService,
} from "@bitwarden/components";

import { PopOutComponent } from "../../../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

type TransferForm = {
  organizationId: FormControl<string | null>;
  collections: FormControl<SelectItemView[]>;
};

@Component({
  standalone: true,
  selector: "app-assign-collections",
  templateUrl: "./assign-collections.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ButtonModule,
    SelectModule,
    FormFieldModule,
    ReactiveFormsModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    PopOutComponent,
    CardComponent,
  ],
})
export class AssignCollections {
  /** All writeable collections */
  private writeableCollections: CollectionView[] = [];

  /** Available organizations to which the cipher can be assigned to */
  organizations$: Observable<Organization[]>;

  /** Selectable collections formatted to use with the MultiSelectComponent */
  collections: SelectItemView[] = [];

  /** The current cipher being altered */
  cipher: CipherView;

  /** Promise associated with the submission form, used with `appApiAction` */
  formPromise: Promise<void>;

  transferForm = this.formBuilder.group<TransferForm>({
    organizationId: new FormControl(null),
    collections: new FormControl([]),
  });

  constructor(
    private location: Location,
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
    private i18nService: I18nService,
    private cipherService: CipherService,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private logService: LogService,
    route: ActivatedRoute,
  ) {
    const $cipher: Observable<CipherView> = route.queryParams.pipe(
      switchMap(({ cipherId }) => this.cipherService.get(cipherId)),
      switchMap((cipherDomain) =>
        this.cipherService
          .getKeyForCipherKeyDecryption(cipherDomain)
          .then(cipherDomain.decrypt.bind(cipherDomain)),
      ),
    );

    combineLatest([$cipher, this.collectionService.decryptedCollections$])
      .pipe(takeUntilDestroyed(), first())
      .subscribe(([cipherView, collections]) => {
        this.cipher = cipherView;

        this.writeableCollections = collections.filter((c) => !c.readOnly);
        this.updateCollections();

        this.transferForm.controls.collections.setValue(
          this.collections.filter((c) => this.cipher.collectionIds.includes(c.id)),
        );
      });

    this.organizations$ = this.organizationService.memberOrganizations$.pipe(
      map((orgs) => {
        return orgs
          .filter((o) => o.enabled && o.status === OrganizationUserStatusType.Confirmed)
          .sort(Utils.getSortFunction(this.i18nService, "name"));
      }),
      tap((orgs) => {
        const { organizationId } = this.transferForm.controls;
        // If there is only one organization, select it by default
        if (organizationId.value === null && orgs.length === 1) {
          this.transferForm.controls.organizationId.setValue(orgs[0].id);
          this.transferForm.controls.organizationId.disable();
        }
      }),
    );

    this.transferForm.controls.organizationId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.updateCollections();
      });
  }

  /** Populate the selectable collections based on the organization selected */
  updateCollections() {
    const { organizationId } = this.transferForm.controls;

    if (organizationId.value === null || this.writeableCollections.length === 0) {
      this.collections = [];
    } else {
      this.collections = this.writeableCollections
        .filter((c) => c.organizationId === organizationId.value)
        .map((c) => ({
          id: c.id,
          value: c.id,
          labelName: c.name,
          listName: c.name,
          icon: "bwi-collection",
        }));
    }
  }

  async submit() {
    const { collections, organizationId } = this.transferForm.getRawValue();
    const collectionIds = collections.map((c) => c.id);

    if (collectionIds.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("selectOneCollection"),
      });
      return;
    }

    const orgs = await firstValueFrom(this.organizations$);
    const orgName =
      orgs.find((o) => o.id === organizationId)?.name ?? this.i18nService.t("organization");

    try {
      this.formPromise = this.cipherService.shareWithServer(
        this.cipher,
        organizationId,
        collectionIds,
      );

      await this.formPromise;

      this.navigateBack();
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("movedItemToOrg", this.cipher.name, orgName),
      });
      return true;
    } catch (e) {
      this.logService.error(e);
    }
    return false;
  }

  /** Navigates the user back to the previous screen */
  navigateBack() {
    this.location.back();
  }
}
