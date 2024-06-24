import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SearchModule, ButtonModule, CardComponent } from "@bitwarden/components";

@Component({
  selector: "app-additional-information",
  templateUrl: "additional-information.component.html",
  standalone: true,
  imports: [CommonModule, SearchModule, JslibModule, FormsModule, ButtonModule, CardComponent],
})
export class AdditionalInformationComponent {
  @Input() notes: string;

  constructor() {}
}
