import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Params, RouterModule } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncString, EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";
import { ToastService } from "@bitwarden/components";

import {
  InputPasswordComponent,
  PasswordInputResult,
} from "../../input-password/input-password.component";

@Component({
  standalone: true,
  selector: "auth-registration-finish",
  templateUrl: "./registration-finish.component.html",
  imports: [CommonModule, JslibModule, RouterModule, InputPasswordComponent],
})
export class RegistrationFinishComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  email: string;

  // Note: this token is the email verification token. It is always supplied as a query param, but
  // it either comes from the email verification email or, if email verification is disabled server side
  // via global settings, it comes directly from the registration-start component directly.
  emailVerificationToken: string;

  constructor(
    private activatedRoute: ActivatedRoute,
    private toastService: ToastService,
    private i18nService: I18nService,
    private cryptoService: CryptoService,
    private accountApiService: AccountApiService,
    // private platformUtilsService: PlatformUtilsService,
    // private acceptOrgInviteService: AcceptOrganizationInviteService,
  ) {}

  async ngOnInit() {
    this.listenForQueryParamChanges();
  }

  private listenForQueryParamChanges() {
    this.activatedRoute.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qParams: Params) => {
      if (qParams.email != null && qParams.email.indexOf("@") > -1) {
        this.email = qParams.email;
      }

      // TODO: query param name of token must be specific to the email verification token
      // or the org invite token
      if (qParams.token != null) {
        this.emailVerificationToken = qParams.token;
      }

      if (qParams.fromEmail && qParams.fromEmail === "true") {
        this.toastService.showToast({
          title: null,
          message: this.i18nService.t("emailVerifiedV2"),
          variant: "success",
        });
      }
    });
  }

  async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    // TODO: Should this be in a register service or something?
    const [newUserKey, newEncUserKey] = await this.cryptoService.makeUserKey(
      passwordInputResult.masterKey,
    );
    if (!newUserKey || !newEncUserKey) {
      throw new Error("User key could not be created");
    }
    const userAsymmetricKeys = await this.cryptoService.makeKeyPair(newUserKey);

    const registerRequest = await this.buildRegisterRequest(
      this.email,
      passwordInputResult,
      newEncUserKey.encryptedString,
      userAsymmetricKeys,
    );

    // TODO: create registration-finish.service.ts
    // override on web to add org invite logic

    // TODO: handle org invite. Discuss existing modifyRegisterRequest approach.
    // // if (this.platformUtilsService.getClientType() === ClientType.Web) {
    // Org invites are deep linked. Non-existent accounts are redirected to the register page.
    // Org user id and token are included here only for validation and two factor purposes.
    // const orgInvite = await acceptOrgInviteService.getOrganizationInvite();
    // if (orgInvite != null) {
    //   request.organizationUserId = orgInvite.organizationUserId;
    //   request.token = orgInvite.token;
    // }
    // Invite is accepted after login (on deep link redirect).
    // // }

    // TODO: either send email verification token or org invite token but not both
    // but must have separate props on the register request object
    // so that the server can differentiate between the two

    await this.accountApiService.registerFinish(registerRequest);
  }

  private async buildRegisterRequest(
    email: string,
    passwordInputResult: PasswordInputResult,
    encryptedUserKey: EncryptedString,
    userAsymmetricKeys: [string, EncString],
  ): Promise<RegisterFinishRequest> {
    // create keysRequest
    const userAsymmetricKeysRequest = new KeysRequest(
      userAsymmetricKeys[0],
      userAsymmetricKeys[1].encryptedString,
    );

    return new RegisterFinishRequest(
      this.email,
      this.emailVerificationToken,
      passwordInputResult.masterKeyHash,
      passwordInputResult.hint,
      encryptedUserKey,
      userAsymmetricKeysRequest,
      passwordInputResult.kdfConfig.kdfType,
      passwordInputResult.kdfConfig.iterations,
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
