import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import {
  Observable,
  Subject,
  combineLatest,
  map,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { DialogService, SelectItemView } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

export interface BulkCollectionAssignmentDialogParams {
  organizationId: OrganizationId;

  /**
   * The ciphers to be assigned to the collections selected in the dialog.
   */
  ciphers: CipherView[];

  /**
   * The collections available to assign the ciphers to.
   */
  availableCollections: CollectionView[];

  /**
   * The currently filtered collection. Selected by default. If the user deselects it in the dialog then it will be
   * removed from the ciphers upon submission.
   */
  activeCollection?: CollectionView;
}

export enum BulkCollectionAssignmentDialogResult {
  Saved = "saved",
  Canceled = "canceled",
}

@Component({
  imports: [SharedModule],
  selector: "app-bulk-collection-assignment-dialog",
  templateUrl: "./bulk-collection-assignment-dialog.component.html",
  standalone: true,
})
export class BulkCollectionAssignmentDialogComponent implements OnDestroy, OnInit {
  protected totalItemCount: number;
  protected editableItemCount: number;
  protected readonlyItemCount: number;
  protected personalItemsCount: number;
  protected availableCollections: SelectItemView[] = [];
  protected selectedCollections: SelectItemView[] = [];
  protected orgName: string;
  protected showOrgSelector: boolean = false;
  protected organizations$: Observable<Organization[]> =
    this.organizationService.organizations$.pipe(
      map((orgs) => orgs.filter((o) => o.enabled).sort((a, b) => a.name.localeCompare(b.name))),
      tap((orgs) => {
        if (orgs.length > 0 && this.showOrgSelector) {
          this.formGroup.patchValue({ selectedOrg: orgs[0].id });
          this.setFormValidators();
        }
      }),
    );

  protected formGroup = this.formBuilder.group({
    selectedOrg: [""],
    collections: [[], [Validators.required]],
  });

  private editableItems: CipherView[] = [];
  private selectedOrgId: OrganizationId;
  private destroy$ = new Subject<void>();

  protected pluralize = (count: number, singular: string, plural: string) =>
    `${count} ${this.i18nService.t(count === 1 ? singular : plural)}`;

  protected transferWarningText = (orgName: string, itemsCount: number) => {
    return orgName
      ? this.i18nService.t(
          "personalItemsWithOrgTransferWarning",
          this.pluralize(itemsCount, "item", "items"),
          orgName,
        )
      : this.i18nService.t(
          "personalItemsTransferWarning",
          this.pluralize(itemsCount, "item", "items"),
        );
  };

  constructor(
    @Inject(DIALOG_DATA) private params: BulkCollectionAssignmentDialogParams,
    private dialogRef: DialogRef<BulkCollectionAssignmentDialogResult>,
    private cipherService: CipherService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private configService: ConfigService,
    private organizationService: OrganizationService,
    private collectionService: CollectionService,
    private formBuilder: FormBuilder,
  ) {}

  async ngOnInit() {
    const v1FCEnabled = await this.configService.getFeatureFlag(FeatureFlag.FlexibleCollectionsV1);
    const restrictProviderAccess = await this.configService.getFeatureFlag(
      FeatureFlag.RestrictProviderAccess,
    );

    this.selectedOrgId = this.params.organizationId;

    const onlyPersonalItems = this.params.ciphers.every((c) => c.organizationId == null);

    if (this.selectedOrgId === "MyVault" || onlyPersonalItems) {
      this.showOrgSelector = true;
    }

    await this.initializeItems(this.selectedOrgId, v1FCEnabled, restrictProviderAccess);

    if (this.selectedOrgId && this.selectedOrgId !== "MyVault") {
      await this.handleOrganizationCiphers();
    }

    // Listen to changes in selected organization and update collections
    this.formGroup.controls.selectedOrg.valueChanges
      .pipe(
        switchMap((orgId) => {
          this.selectedCollections = [];
          this.selectedOrgId = orgId as OrganizationId;
          return this.getCollectionsForOrganization(
            this.selectedOrgId,
            v1FCEnabled,
            restrictProviderAccess,
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((collections) => {
        this.availableCollections = collections.map((c) => ({
          icon: "bwi-collection",
          id: c.id,
          labelName: c.name,
          listName: c.name,
        }));
      });
  }

  private sortItems = (a: SelectItemView, b: SelectItemView) =>
    this.i18nService.collator.compare(a.labelName, b.labelName);

  selectCollections(items: SelectItemView[]) {
    this.selectedCollections = [...this.selectedCollections, ...items].sort(this.sortItems);

    this.availableCollections = this.availableCollections.filter(
      (item) => !items.find((i) => i.id === item.id),
    );
  }

  unselectCollection(i: number) {
    const removed = this.selectedCollections.splice(i, 1);
    this.availableCollections = [...this.availableCollections, ...removed].sort(this.sortItems);
  }

  get isValid() {
    return this.params.activeCollection != null || this.selectedCollections.length > 0;
  }

  submit = async () => {
    if (!this.isValid) {
      return;
    }

    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    // Retrieve ciphers that belong to an organization
    const cipherIds = this.editableItems
      .filter((i) => i.organizationId)
      .map((i) => i.id as CipherId);

    // Move personal items to the organization
    if (this.personalItemsCount > 0) {
      await this.moveToOrganization(
        this.selectedOrgId,
        this.params.ciphers.filter((c) => c.organizationId == null),
        this.selectedCollections.map((i) => i.id as CollectionId),
      );
    }

    if (cipherIds.length > 0) {
      await this.bulkUpdateCollections(cipherIds);
    }

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("successfullyAssignedCollections"),
    );

    this.dialogRef.close(BulkCollectionAssignmentDialogResult.Saved);
  };

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async handleOrganizationCiphers() {
    // If no ciphers are editable, close the dialog
    if (this.editableItemCount == 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected"),
      );
      this.dialogRef.close(BulkCollectionAssignmentDialogResult.Canceled);
    }

    this.availableCollections = this.params.availableCollections.map((c) => ({
      icon: "bwi-collection",
      id: c.id,
      labelName: c.name,
      listName: c.name,
    }));

    // Retrieve the shared collection IDs between ciphers.
    // If only one cipher exists, it retrieves the collection IDs of that cipher.
    const sharedCollectionIds = this.params.ciphers
      .map((c) => c.collectionIds)
      .reduce((sharedIds, collectionIds) => sharedIds.filter((id) => collectionIds.includes(id)));

    // Filter the shared collections to select only those that are associated with the ciphers, excluding the active collection
    const assignedCollections = this.availableCollections
      .filter(
        (collection) =>
          sharedCollectionIds.includes(collection.id) &&
          collection.id !== this.params.activeCollection?.id,
      )
      .map((collection) => ({
        icon: "bwi-collection",
        id: collection.id,
        labelName: collection.labelName,
        listName: collection.listName,
      }));

    if (assignedCollections.length > 0) {
      this.selectCollections(assignedCollections);
    }

    // If the active collection is set, select it by default
    if (this.params.activeCollection) {
      this.selectCollections([
        {
          icon: "bwi-collection",
          id: this.params.activeCollection.id,
          labelName: this.params.activeCollection.name,
          listName: this.params.activeCollection.name,
        },
      ]);
    }
  }

  private async initializeItems(
    organizationId: OrganizationId,
    v1FCEnabled: boolean,
    restrictProviderAccess: boolean,
  ) {
    this.totalItemCount = this.params.ciphers.length;

    // If organizationId is not present, then all ciphers are considered personal items
    if (!organizationId) {
      this.editableItems = this.params.ciphers;
      this.editableItemCount = this.params.ciphers.length;
      this.personalItemsCount = this.params.ciphers.length;
      return;
    }

    const org = await this.organizationService.get(organizationId);
    this.orgName = org.name;

    this.editableItems = org.canEditAllCiphers(v1FCEnabled, restrictProviderAccess)
      ? this.params.ciphers
      : this.params.ciphers.filter((c) => c.edit);

    this.editableItemCount = this.editableItems.length;
    this.personalItemsCount = this.params.ciphers.filter((c) => c.organizationId == null).length;
    this.readonlyItemCount = this.totalItemCount - this.editableItemCount;
  }

  private setFormValidators() {
    const selectedOrgControl = this.formGroup.get("selectedOrg");
    selectedOrgControl?.setValidators([Validators.required]);
    selectedOrgControl?.updateValueAndValidity();
  }

  /**
   * Retrieves the collections for the organization with the given ID.
   * @param orgId
   * @param v1FCEnabled
   * @param restrictProviderAccess
   * @returns An observable of the collections for the organization.
   */
  private getCollectionsForOrganization(
    orgId: OrganizationId,
    v1FCEnabled: boolean,
    restrictProviderAccess: boolean,
  ): Observable<CollectionView[]> {
    return combineLatest([
      this.collectionService.decryptedCollections$,
      this.organizationService.organizations$,
    ]).pipe(
      map(([collections, organizations]) => {
        const org = organizations.find((o) => o.id === orgId);
        this.orgName = org.name;

        return collections.filter((c) => {
          return (
            c.organizationId === orgId && c.canEditItems(org, v1FCEnabled, restrictProviderAccess)
          );
        });
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  private async moveToOrganization(
    organizationId: OrganizationId,
    shareableCiphers: CipherView[],
    selectedCollectionIds: CollectionId[],
  ) {
    await this.cipherService.shareManyWithServer(
      shareableCiphers,
      organizationId,
      selectedCollectionIds,
    );

    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("movedItemsToOrg", this.orgName ?? this.i18nService.t("organization")),
    );
  }

  private async bulkUpdateCollections(cipherIds: CipherId[]) {
    if (this.selectedCollections.length > 0) {
      await this.cipherService.bulkUpdateCollectionsWithServer(
        this.selectedOrgId,
        cipherIds,
        this.selectedCollections.map((i) => i.id as CollectionId),
        false,
      );
    }

    if (
      this.params.activeCollection != null &&
      this.selectedCollections.find((c) => c.id === this.params.activeCollection.id) == null
    ) {
      await this.cipherService.bulkUpdateCollectionsWithServer(
        this.selectedOrgId,
        cipherIds,
        [this.params.activeCollection.id as CollectionId],
        true,
      );
    }
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<BulkCollectionAssignmentDialogParams>,
  ) {
    return dialogService.open<
      BulkCollectionAssignmentDialogResult,
      BulkCollectionAssignmentDialogParams
    >(BulkCollectionAssignmentDialogComponent, config);
  }
}
