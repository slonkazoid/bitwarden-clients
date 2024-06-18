import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { InputPasswordComponent } from "@bitwarden/auth/angular";

@Component({
  standalone: true,
  selector: "app-set-password-v2",
  templateUrl: "./set-password-v2.component.html",
  imports: [InputPasswordComponent],
})
export class SetPasswordV2Component implements OnInit {
  orgName: string;
  orgId: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  async ngOnInit() {
    const qParams = await firstValueFrom(this.route.queryParams);

    if (qParams.identifier != null && qParams.orgId != null) {
      this.orgName = qParams.identifier; // from SsoComponent handleChangePasswordRequired()
      this.orgId = qParams.orgId;
    }

    await this.router.navigate(["/"]);
  }
}
