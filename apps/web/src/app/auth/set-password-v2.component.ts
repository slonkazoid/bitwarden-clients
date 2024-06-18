import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { InputPasswordComponent, PasswordInputResult } from "@bitwarden/auth/angular";

@Component({
  standalone: true,
  selector: "app-set-password-v2",
  templateUrl: "./set-password-v2.component.html",
  imports: [InputPasswordComponent, JslibModule],
})
export class SetPasswordV2Component implements OnInit {
  orgName: string;
  // orgId: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  async ngOnInit() {
    const qParams = await firstValueFrom(this.route.queryParams);

    if (qParams.identifier != null) {
      this.orgName = qParams.identifier; // from SsoComponent handleChangePasswordRequired()
      // this.orgId = qParams.orgId;
    } else {
      await this.router.navigate(["/"]);
    }
  }

  getPasswordInputResult(passwordInputResult: PasswordInputResult) {
    console.log(passwordInputResult);
  }
}
