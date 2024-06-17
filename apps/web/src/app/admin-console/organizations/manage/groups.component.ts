import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  from,
  lastValueFrom,
  map,
  switchMap,
  tap,
} from "rxjs";
import { debounceTime, first } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { CollectionData } from "@bitwarden/common/vault/models/data/collection.data";
import { Collection } from "@bitwarden/common/vault/models/domain/collection";
import {
  CollectionDetailsResponse,
  CollectionResponse,
} from "@bitwarden/common/vault/models/response/collection.response";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { DialogService, TableDataSource } from "@bitwarden/components";

import { InternalGroupService as GroupService, GroupView } from "../core";

import {
  GroupAddEditDialogResultType,
  GroupAddEditTabType,
  openGroupAddEditDialog,
} from "./group-add-edit.component";

type CollectionViewMap = {
  [id: string]: CollectionView;
};

type GroupDetailsRow = {
  /**
   * Group Id (used for searching)
   */
  id: string;

  /**
   * Group name (used for searching)
   */
  name: string;

  /**
   * Details used for displaying group information
   */
  details: GroupView;

  /**
   * True if the group is selected in the table
   */
  checked?: boolean;

  /**
   * A list of collection names the group has access to
   */
  collectionNames?: string[];
};

@Component({
  templateUrl: "groups.component.html",
})
export class GroupsComponent {
  loading = true;
  organizationId: string;

  protected dataSource = new TableDataSource<GroupDetailsRow>();
  protected searchControl = new FormControl("");

  protected ModalTabType = GroupAddEditTabType;
  private refreshGroups$ = new BehaviorSubject<void>(null);

  constructor(
    private apiService: ApiService,
    private groupService: GroupService,
    private route: ActivatedRoute,
    private i18nService: I18nService,
    private dialogService: DialogService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private collectionService: CollectionService,
  ) {
    this.route.params
      .pipe(
        tap((params) => (this.organizationId = params.organizationId)),
        switchMap(() =>
          combineLatest([
            // collectionMap
            from(this.apiService.getCollections(this.organizationId)).pipe(
              concatMap((response) => this.toCollectionMap(response)),
            ),
            // groups
            this.refreshGroups$.pipe(
              switchMap(() => this.groupService.getAll(this.organizationId)),
            ),
          ]),
        ),
        map(([collectionMap, groups]) => {
          return groups
            .sort(Utils.getSortFunction(this.i18nService, "name"))
            .map<GroupDetailsRow>((g) => ({
              id: g.id,
              name: g.name,
              details: g,
              checked: false,
              collectionNames: g.collections
                .map((c) => collectionMap[c.id]?.name)
                .sort(this.i18nService.collator?.compare),
            }));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((groups) => {
        this.dataSource.data = groups;
        this.loading = false;
      });

    // Connect the search input to the table dataSource filter input
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));

    this.route.queryParams.pipe(first(), takeUntilDestroyed()).subscribe((qParams) => {
      this.searchControl.setValue(qParams.search);
    });
  }

  async edit(
    group: GroupDetailsRow,
    startingTabIndex: GroupAddEditTabType = GroupAddEditTabType.Info,
  ) {
    const dialogRef = openGroupAddEditDialog(this.dialogService, {
      data: {
        initialTab: startingTabIndex,
        organizationId: this.organizationId,
        groupId: group != null ? group.details.id : null,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result == GroupAddEditDialogResultType.Saved) {
      this.refreshGroups$.next();
    } else if (result == GroupAddEditDialogResultType.Deleted) {
      this.removeGroup(group.details.id);
    }
  }

  add() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.edit(null);
  }

  async delete(groupRow: GroupDetailsRow) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: groupRow.details.name,
      content: { key: "deleteGroupConfirmation" },
      type: "warning",
    });
    if (!confirmed) {
      return false;
    }

    try {
      await this.groupService.delete(this.organizationId, groupRow.details.id);
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("deletedGroupId", groupRow.details.name),
      );
      this.removeGroup(groupRow.details.id);
    } catch (e) {
      this.logService.error(e);
    }
  }

  async deleteAllSelected() {
    const groupsToDelete = this.dataSource.data.filter((g) => g.checked);

    if (groupsToDelete.length == 0) {
      return;
    }

    const deleteMessage = groupsToDelete.map((g) => g.details.name).join(", ");
    const confirmed = await this.dialogService.openSimpleDialog({
      title: {
        key: "deleteMultipleGroupsConfirmation",
        placeholders: [groupsToDelete.length.toString()],
      },
      content: deleteMessage,
      type: "warning",
    });
    if (!confirmed) {
      return false;
    }

    try {
      await this.groupService.deleteMany(
        this.organizationId,
        groupsToDelete.map((g) => g.details.id),
      );
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("deletedManyGroups", groupsToDelete.length.toString()),
      );

      groupsToDelete.forEach((g) => this.removeGroup(g.details.id));
    } catch (e) {
      this.logService.error(e);
    }
  }

  check(groupRow: GroupDetailsRow) {
    groupRow.checked = !groupRow.checked;
  }

  toggleAllVisible(event: Event) {
    this.dataSource.filteredData.forEach(
      (g) => (g.checked = (event.target as HTMLInputElement).checked),
    );
  }

  private removeGroup(id: string) {
    const index = this.dataSource.data.findIndex((g) => g.details.id === id);
    if (index > -1) {
      // Clone the array so that the setter for dataSource.data is triggered to update the table rendering
      const updatedData = [...this.dataSource.data];
      updatedData.splice(index, 1);
      this.dataSource.data = updatedData;
    }
  }

  private async toCollectionMap(response: ListResponse<CollectionResponse>) {
    const collections = response.data.map(
      (r) => new Collection(new CollectionData(r as CollectionDetailsResponse)),
    );
    const decryptedCollections = await this.collectionService.decryptMany(collections);

    // Convert to an object using collection Ids as keys for faster name lookups
    const collectionMap: CollectionViewMap = {};
    decryptedCollections.forEach((c) => (collectionMap[c.id] = c));

    return collectionMap;
  }
}
