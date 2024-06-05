import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SearchModule } from "@bitwarden/components";

import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

@Component({
  selector: "app-add-edit-v2",
  templateUrl: "add-edit-v2.component.html",
  standalone: true,
  imports: [
    CommonModule,
    SearchModule,
    JslibModule,
    FormsModule,
    PopupPageComponent,
    PopupHeaderComponent,
  ],
})
export class AddEditV2Component {
  itemType: string;
  isNew: boolean;

  constructor(private route: ActivatedRoute) {
    this.subscribeToParams();
  }

  subscribeToParams(): Subscription {
    return this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.itemType = params.type;
      this.isNew = params.isNew;
    });
  }
}
