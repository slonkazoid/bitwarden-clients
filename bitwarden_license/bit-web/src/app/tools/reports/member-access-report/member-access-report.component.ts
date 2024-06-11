import { Component, OnInit } from "@angular/core";
import { BehaviorSubject } from "rxjs";

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
  protected dataSource = new TableDataSource<MemberAccessReportView>();
  private _searchText$ = new BehaviorSubject<string>("");

  get searchText() {
    return this._searchText$.value;
  }

  set searchText(value: string) {
    this._searchText$.next(value);
  }
  constructor(protected reportService: MemberAccessReportService) {}

  ngOnInit() {
    this.dataSource.data = this.reportService.getMemberAccessMockData();
  }
}
