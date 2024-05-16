import { NgModule } from "@angular/core";

import { NavigationModule } from "@bitwarden/components";
import { OrgSwitcherComponent } from "@bitwarden/web-vault/app/layouts/org-switcher/org-switcher.component";
import { WebLayoutComponent } from "@bitwarden/web-vault/app/layouts/web-layout.component";
import { SharedModule } from "@bitwarden/web-vault/app/shared/shared.module";

import { LayoutComponent } from "./layout.component";
import { NavigationComponent } from "./navigation.component";

@NgModule({
  imports: [SharedModule, NavigationModule, WebLayoutComponent, OrgSwitcherComponent],
  declarations: [LayoutComponent, NavigationComponent],
})
export class LayoutModule {}
