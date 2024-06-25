import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { IconButtonModule, CardComponent, InputModule } from "@bitwarden/components";

@Component({
  selector: "app-additional-information",
  templateUrl: "additional-information.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, CardComponent, IconButtonModule, InputModule],
})
export class AdditionalInformationComponent {
  @Input() notes: string;

  constructor() {}
}
