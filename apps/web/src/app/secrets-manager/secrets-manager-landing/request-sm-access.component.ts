import { Component, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { RequestSMAccessRequest } from "@bitwarden/common/auth/models/request/request-sm-access.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { NoItemsModule, SearchModule } from "@bitwarden/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { OssModule } from "../../oss.module";
import { SharedModule } from "../../shared/shared.module";

@Component({
  selector: "app-request-sm-access",
  standalone: true,
  templateUrl: "request-sm-access.component.html",
  imports: [SharedModule, SearchModule, NoItemsModule, HeaderModule, OssModule],
})
export class RequestSMAccessComponent implements OnInit {
  requestAccessForm = new FormGroup({
    requestAccessEmailContents: new FormControl(
      this.i18nService.t("requestAccessSMDefaultEmailContent"),
    ),
    selectedOrganization: new FormControl<Organization>(null, [Validators.required]),
  });
  organizations: Organization[] = [];

  constructor(
    private router: Router,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private i18nService: I18nService,
    private organizationService: OrganizationService,
  ) {}

  async ngOnInit() {
    this.requestAccessForm = new FormGroup({
      requestAccessEmailContents: new FormControl(this.textAreaValue),
      selectedOrganization: new FormControl("", [Validators.required]),
    });

    this.organizations = (await this.organizationService.getAll()).filter((e) => e.enabled);

    if (this.organizations == null || this.organizations.length < 1) {
      await this.returnToLandingPage();
    }
  }

  submit = async () => {
    this.requestAccessForm.markAllAsTouched();
    if (this.requestAccessForm.invalid) {
      return;
    }

    const formValue = this.requestAccessForm.value;
    const request = new RequestSMAccessRequest();
    request.OrganizationId = formValue.selectedOrganization.id;
    request.EmailContent = formValue.requestAccessEmailContents;

    try {
      await this.apiService.requestSMAccessFromAdmins(request);
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("smAccessRequestEmailSent"),
      );
      await this.router.navigate(["/"]);
    } catch (e) {
      this.logService.error(e);
    }
  };

  async returnToLandingPage() {
    await this.router.navigate(["/landing"]);
  }
}
