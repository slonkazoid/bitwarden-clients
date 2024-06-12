import { Component, ViewChild, ViewContainerRef } from "@angular/core";
import { Router } from "@angular/router";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { NoItemsModule, SearchModule } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared/shared.module";

@Component({
  selector: "app-landing",
  standalone: true,
  imports: [SharedModule, SearchModule, NoItemsModule, HeaderModule],
  templateUrl: "sm-landing.component.html",
})
export class SMLandingComponent {
  @ViewChild("sendAddEdit", { read: ViewContainerRef, static: true })
  sendAddEditModalRef: ViewContainerRef;
  actionPromise: any;
  organizationEnabled: any;
  userIsAdmin: any;
  organizationId: any;

  constructor(
    private router: Router,
    private organizationService: OrganizationService,
  ) {}

  async learnMore() {
    window.open("https://bitwarden.com/help/secrets-manager-overview/", "_blank"); // Opens the URL in a new tab
  }

  async tryEnableSM() {
    const enabledOrgs = (await this.organizationService.getAll()).filter((e) => e.enabled);

    if (enabledOrgs != null && enabledOrgs.length > 0) {
      const orgsUserIsAdminOf: Organization[] = enabledOrgs.filter(
        (o) => o.isAdmin && o.enabled == true,
      );
      //User is a part of at least one org and user is an admin of at least one
      if (orgsUserIsAdminOf != null && orgsUserIsAdminOf?.length > 0) {
        const organizationId = orgsUserIsAdminOf[0]?.id;
        await this.router.navigate([`/organizations/${organizationId}/billing/subscription`]);
      }

      //User is not an admin but there are orgs
      await this.router.navigate([`/request-sm-access`]);
    } else {
      //User needs to create an org to sign up for secrets manager
      await this.router.navigate(["/create-organization"]);
      return;
    }
  }
}
