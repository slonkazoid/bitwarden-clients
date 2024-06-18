import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SearchModule, ButtonModule } from "@bitwarden/components";

@Component({
  selector: "app-additional-information-v2",
  templateUrl: "additional-information-v2.component.html",
  standalone: true,
  imports: [CommonModule, SearchModule, JslibModule, FormsModule, ButtonModule],
})
export class AdditionalInformationV2Component {
  @Input() notes: string;

  constructor(private platformUtilsService: PlatformUtilsService) {}

  copy(textData: string) {
    this.platformUtilsService.copyToClipboard(textData, null);
    this.platformUtilsService.showToast("info", null, "Copy Successful");
  }
}
