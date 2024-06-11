import { Component, OnInit } from "@angular/core";
import { BehaviorSubject, Subject, from, switchMap, takeUntil } from "rxjs";

import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { SearchModule, TableDataSource } from "@bitwarden/components";

import { HeaderModule } from "../../../../../../../apps/web/src/app/layouts/header/header.module";
import { SharedModule } from "../../../../../../../apps/web/src/app/shared";

import { MemberAccessReportService } from "./member-access-report.service";
import { MemberAccessReportView } from "./view/member-access-report.view";

@Component({
  selector: "member-access-report",
  templateUrl: "member-access-report.component.html",
  imports: [SharedModule, SearchModule, HeaderModule],
  standalone: true,
})
export class MemberAccessReportComponent implements OnInit {
  protected destroy$ = new Subject<void>();
  protected dataSource = new TableDataSource<MemberAccessReportView>();
  private _searchText$ = new BehaviorSubject<string>("");

  get searchText() {
    return this._searchText$.value;
  }

  set searchText(value: string) {
    this._searchText$.next(value);
    this.dataSource.filter = value;
  }

  constructor(
    protected reportService: MemberAccessReportService,
    private searchService: SearchService,
  ) {}

  ngOnInit() {
    this.dataSource.data = this.reportService.getMemberAccessMockData();

    this._searchText$.pipe(
      switchMap((searchText) => from(this.searchService.isSearchable(searchText))),
      takeUntil(this.destroy$),
    );
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
