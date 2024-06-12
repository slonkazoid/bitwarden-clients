import { CommonModule } from "@angular/common";
import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ButtonModule, NoItemsModule, MenuModule } from "@bitwarden/components";

@Component({
  selector: "app-new-item-dropdown",
  templateUrl: "new-item-dropdown-v2.component.html",
  standalone: true,
  imports: [NoItemsModule, JslibModule, CommonModule, ButtonModule, RouterLink, MenuModule],
})
export class NewItemDropdownV2Component implements OnInit, OnDestroy {
  @Input() selectedVaultId: string;

  cipherType = CipherType;

  constructor(private router: Router) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  newItemNavigate(type: CipherType) {
    const selectedVault = this.selectedVaultId;

    void this.router.navigate(["/add-cipher"], {
      queryParams: { type: type, isNew: true, selectedVault },
    });
  }
}
