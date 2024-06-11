import { NgModule } from "@angular/core";

import { LooseComponentsModule } from "@bitwarden/web-vault/app/shared";
import { SharedModule } from "@bitwarden/web-vault/app/shared/shared.module";

import { MemberAccessReportComponent } from "./member-access-report/member-access-report.component";
import { ReportsRoutingModule } from "./reports-routing.module";

@NgModule({
  imports: [SharedModule, ReportsRoutingModule, LooseComponentsModule, MemberAccessReportComponent],
})
export class ReportsModule {}
