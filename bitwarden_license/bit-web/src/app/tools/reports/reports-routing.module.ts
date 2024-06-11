import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { IsEnterpriseOrgGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/is-enterprise-org.guard";

import { MemberAccessReportComponent } from "./member-access-report/member-access-report.component";

const routes: Routes = [
  {
    path: "member-access-report",
    component: MemberAccessReportComponent,
    data: {
      titleId: "memberAccessReport",
    },
    canActivate: [IsEnterpriseOrgGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReportsRoutingModule {}
