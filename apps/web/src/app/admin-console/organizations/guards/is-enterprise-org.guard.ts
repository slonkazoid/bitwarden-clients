import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from "@angular/router";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProductType } from "@bitwarden/common/enums";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { DialogService } from "@bitwarden/components";

@Injectable({
  providedIn: "root",
})
export class IsEnterpriseOrgGuard implements CanActivate {
  constructor(
    private router: Router,
    private organizationService: OrganizationService,
    private messagingService: MessagingService,
    private dialogService: DialogService,
  ) {}

  async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const org = await this.organizationService.get(route.params.organizationId);

    if (org == null) {
      return this.router.createUrlTree(["/"]);
    }

    if (org.planProductType != ProductType.Enterprise) {
      // Users without billing permission can't access billing
      if (!org.canEditSubscription) {
        await this.dialogService.openSimpleDialog({
          title: { key: "upgradeOrganizationEnterprise" },
          content: { key: "onlyAvailableForEnterpriseOrganization" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "info",
        });
        return false;
      } else {
        this.messagingService.send("upgradeEnterprise", {
          organizationId: org.id,
          queryParams: { upgrade: true },
        });
      }
    }

    return org.planProductType == ProductType.Enterprise;
  }
}
