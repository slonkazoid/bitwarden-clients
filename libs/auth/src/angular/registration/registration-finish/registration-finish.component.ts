import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Params, Router, RouterModule } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { InputPasswordComponent } from "../../input-password/input-password.component";
import { PasswordInputResult } from "../../input-password/password-input-result";

import { RegistrationFinishService } from "./registration-finish.service";

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
    private router: Router,
    private toastService: ToastService,
    private i18nService: I18nService,
    private registrationFinishService: RegistrationFinishService,
  ) {}

  async ngOnInit() {
    this.listenForQueryParamChanges();
  }

  private listenForQueryParamChanges() {
    this.activatedRoute.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qParams: Params) => {
      if (qParams.email != null && qParams.email.indexOf("@") > -1) {
        this.email = qParams.email;
      }

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
    try {
      await this.registrationFinishService.finishRegistration(
        this.email,
        passwordInputResult,
        this.emailVerificationToken,
      );
    } catch (e) {
      this.handleRegistrationError(e);
      return;
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("newAccountCreated"),
    });

    await this.router.navigate(["/login"], { queryParams: { email: this.email } });
  }

  private handleRegistrationError(error: unknown) {
    if (error instanceof ErrorResponse) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("unexpectedError"),
        message: error.message,
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
