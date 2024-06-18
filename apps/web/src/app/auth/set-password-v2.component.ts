import { Component } from "@angular/core";

import { InputPasswordComponent } from "@bitwarden/auth/angular";

@Component({
  standalone: true,
  selector: "app-set-password-v2",
  templateUrl: "./set-password-v2.component.html",
  imports: [InputPasswordComponent],
})
export class SetPasswordV2Component {}
