import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Params, RouterModule } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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

  constructor(
    private activatedRoute: ActivatedRoute,
    private toastService: ToastService,
    private i18nService: I18nService,
    private cryptoService: CryptoService,
  ) {}

  async ngOnInit() {
    this.listenForQueryParamChanges();
  }

  private listenForQueryParamChanges() {
    this.activatedRoute.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qParams: Params) => {
      if (qParams.email != null && qParams.email.indexOf("@") > -1) {
        this.email = qParams.email;
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

  async handlePasswordFormSubmit(result: PasswordInputResult) {
    // TODO: Should this be in a register service or something?
    // const [newUserKey, newEncUserKey] = await this.cryptoService.makeUserKey(result.masterKey);
    // if (!newUserKey || !newEncUserKey) {
    //   throw new Error("User key could not be created");
    // }
    // const userAsymmetricKeys = await this.cryptoService.makeKeyPair(newUserKey);
    // TODO: handle org invite. Discuss existing modifyRegisterRequest approach.
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
