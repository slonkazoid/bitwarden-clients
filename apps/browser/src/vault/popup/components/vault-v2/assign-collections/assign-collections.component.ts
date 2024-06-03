import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule } from "@bitwarden/components";

import { PopOutComponent } from "../../../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

@Component({
  standalone: true,
  selector: "app-assign-collections",
  templateUrl: "./assign-collections.component.html",
  imports: [
    JslibModule,
    ButtonModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    PopOutComponent,
  ],
})
export class AssignCollections {
  constructor(
    private location: Location,
    route: ActivatedRoute,
  ) {
    route.queryParams.pipe(takeUntilDestroyed(), first()).subscribe(() => {});
  }

  cancel() {
    this.location.back();
  }
}
