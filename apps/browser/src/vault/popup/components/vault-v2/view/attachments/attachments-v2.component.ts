import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { SearchModule, ButtonModule } from "@bitwarden/components";

@Component({
  selector: "app-attachments-v2",
  templateUrl: "attachments-v2.component.html",
  standalone: true,
  imports: [CommonModule, SearchModule, JslibModule, FormsModule, ButtonModule],
})
export class AttachmentsV2Component {
  @Input() attachments: AttachmentView[];

  constructor() {}
}
