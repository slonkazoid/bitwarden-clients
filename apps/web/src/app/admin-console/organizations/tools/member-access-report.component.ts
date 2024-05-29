import { Component, OnInit } from "@angular/core";
import { BehaviorSubject } from "rxjs";

import { SearchModule, TableDataSource } from "@bitwarden/components";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared";

import { MemberAccessReportView } from "./models/view/member-access-report.view";
import { ReportService } from "./services/report.service";

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
  constructor(protected reportService: ReportService) {}

  ngOnInit() {
    this.dataSource.data = this.reportService.getMemberAccessMockData();
  }
}
