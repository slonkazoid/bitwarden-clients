import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { filter, first, firstValueFrom, map, switchMap, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { OrganizationAutoEnrollStatusResponse } from "@bitwarden/common/admin-console/models/response/organization-auto-enroll-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { ToastService } from "../../../../components/src/toast";
import { InputPasswordComponent } from "../input-password/input-password.component";
import { PasswordInputResult } from "../input-password/password-input-result";

import { SetPasswordJitService } from "./set-password-jit.service.abstraction";

@Component({
  standalone: true,
  selector: "auth-set-password-jit",
  templateUrl: "set-password-jit.component.html",
  imports: [CommonModule, InputPasswordComponent, JslibModule],
})
export class SetPasswordJitComponent implements OnInit {
  email: string;
  masterPasswordPolicyOptions: MasterPasswordPolicyOptions;
  orgId: string;
  orgSsoIdentifier: string;
  resetPasswordAutoEnroll: boolean;
  submitting = false;
  syncLoading = false;
  userId: UserId;

  constructor(
    private accountService: AccountService,
    private activatedRoute: ActivatedRoute,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private policyApiService: PolicyApiServiceAbstraction,
    private router: Router,
    private setPasswordJitService: SetPasswordJitService,
    private syncService: SyncService,
    private toastService: ToastService,
    private validationService: ValidationService,
  ) {}

  async ngOnInit() {
    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

    await this.syncService.fullSync(true);
    this.syncLoading = false;

    this.userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;

    this.activatedRoute.queryParams
      .pipe(
        first(),
        map((qParams) => qParams?.identifier),
        filter((orgSsoId) => orgSsoId != null),
        tap((orgSsoId: string) => {
          this.orgSsoIdentifier = orgSsoId;
        }),
        switchMap((orgSsoId: string) => this.organizationApiService.getAutoEnrollStatus(orgSsoId)),
        tap((orgAutoEnrollStatusResponse: OrganizationAutoEnrollStatusResponse) => {
          this.orgId = orgAutoEnrollStatusResponse.id;
          this.resetPasswordAutoEnroll = orgAutoEnrollStatusResponse.resetPasswordEnabled;
        }),
        switchMap((orgAutoEnrollStatusResponse: OrganizationAutoEnrollStatusResponse) =>
          // Must get org id from response to get master password policy options
          this.policyApiService.getMasterPasswordPolicyOptsForOrgUser(
            orgAutoEnrollStatusResponse.id,
          ),
        ),
        tap((masterPasswordPolicyOptions: MasterPasswordPolicyOptions) => {
          this.masterPasswordPolicyOptions = masterPasswordPolicyOptions;
        }),
      )
      .subscribe({
        error: () => {
          this.toastService.showToast({
            variant: "error",
            title: null,
            message: this.i18nService.t("errorOccurred"),
          });
        },
      });
  }

  async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    this.submitting = true;

    try {
      await this.setPasswordJitService.setPassword(
        passwordInputResult,
        this.orgSsoIdentifier,
        this.resetPasswordAutoEnroll,
        this.userId,
      );

      await this.setPasswordJitService.onSetPasswordSuccess();

      await this.router.navigate(["vault"]);
    } catch (e) {
      this.validationService.showError(e);
      return;
    }

    this.submitting = false;
  }
}
