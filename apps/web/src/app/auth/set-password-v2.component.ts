import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { filter, first, firstValueFrom, map, of, switchMap, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { InputPasswordComponent, PasswordInputResult } from "@bitwarden/auth/angular";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationAutoEnrollStatusResponse } from "@bitwarden/common/admin-console/models/response/organization-auto-enroll-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";

@Component({
  standalone: true,
  selector: "app-set-password-v2",
  templateUrl: "./set-password-v2.component.html",
  imports: [CommonModule, InputPasswordComponent, JslibModule],
})
export class SetPasswordV2Component implements OnInit {
  email: string;
  forceSetPasswordReason: ForceSetPasswordReason = ForceSetPasswordReason.None;
  ForceSetPasswordReason = ForceSetPasswordReason;
  orgId: string;
  orgSsoIdentifier: string;
  passwordInputResult: PasswordInputResult;
  resetPasswordAutoEnroll = false;
  syncLoading = true;
  userId: UserId;

  constructor(
    private route: ActivatedRoute,
    private accountService: AccountService,
    private cryptoService: CryptoService,
    private i18nService: I18nService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private ssoLoginService: SsoLoginServiceAbstraction,
    private syncService: SyncService,
  ) {}

  async ngOnInit() {
    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

    await this.syncService.fullSync(true);
    this.syncLoading = false;

    this.userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;

    this.forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(this.userId),
    );

    this.route.queryParams
      .pipe(
        first(),
        switchMap((qParams) => {
          if (qParams.identifier != null) {
            return of(qParams.identifier);
          } else {
            // Try to get orgSsoId from state as fallback
            // Note: this is primarily for the TDE user w/out MP obtains admin MP reset permission scenario.
            return this.ssoLoginService.getActiveUserOrganizationSsoIdentifier();
          }
        }),
        filter((orgSsoId) => orgSsoId != null),
        tap((orgSsoId: string) => {
          this.orgSsoIdentifier = orgSsoId;
        }),
        switchMap((orgSsoId: string) => this.organizationApiService.getAutoEnrollStatus(orgSsoId)),
        tap((orgAutoEnrollStatusResponse: OrganizationAutoEnrollStatusResponse) => {
          this.orgId = orgAutoEnrollStatusResponse.id;
          this.resetPasswordAutoEnroll = orgAutoEnrollStatusResponse.resetPasswordEnabled;
        }),
        // switchMap((orgAutoEnrollStatusResponse: OrganizationAutoEnrollStatusResponse) =>
        //   // Must get org id from response to get master password policy options
        //   this.policyApiService.getMasterPasswordPolicyOptsForOrgUser(
        //     orgAutoEnrollStatusResponse.id,
        //   ),
        // ),
        // tap((masterPasswordPolicyOptions: MasterPasswordPolicyOptions) => {
        //   this.enforcedPolicyOptions = masterPasswordPolicyOptions;
        // }),
      )
      // eslint-disable-next-line rxjs-angular/prefer-takeuntil
      .subscribe({
        error: () => {
          this.platformUtilsService.showToast("error", null, this.i18nService.t("errorOccurred"));
        },
      });

    // const qParams = await firstValueFrom(this.route.queryParams);

    // if (qParams.identifier != null) {
    //   this.orgIdentifier = qParams.identifier; // from SsoComponent handleChangePasswordRequired()
    // } else {
    //   await this.router.navigate(["/"]);
    // }
  }

  async getPasswordInputResult(passwordInputResult: PasswordInputResult) {
    console.log(passwordInputResult);
    this.passwordInputResult = passwordInputResult;
    await this.submit();
  }

  async submit() {
    let newProtectedUserKey: [UserKey, EncString] = null;
    const userKey = await this.cryptoService.getUserKey();

    if (userKey == null) {
      newProtectedUserKey = await this.cryptoService.makeUserKey(
        this.passwordInputResult.masterKey,
      );
    } else {
      newProtectedUserKey = await this.cryptoService.encryptUserKeyWithMasterKey(
        this.passwordInputResult.masterKey,
      );
    }
  }
}
