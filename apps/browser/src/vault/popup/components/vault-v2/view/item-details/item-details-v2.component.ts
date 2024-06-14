import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SearchModule, ButtonModule } from "@bitwarden/components";

@Component({
  selector: "app-item-details-v2",
  templateUrl: "item-details-v2.component.html",
  standalone: true,
  imports: [CommonModule, SearchModule, JslibModule, FormsModule, ButtonModule],
})
export class ItemDetailsV2Component {
  @Input() cipher: any;
  @Input() organization?: any;
  @Input() collections?: any;
  @Input() folder?: any;

  constructor() {}
}
