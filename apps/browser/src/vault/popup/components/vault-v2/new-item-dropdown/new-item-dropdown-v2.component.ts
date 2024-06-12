import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, RouterLink } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ButtonModule, NoItemsModule, MenuModule } from "@bitwarden/components";

import {
  MY_VAULT_ID,
  VaultPopupListFiltersService,
} from "../../../services/vault-popup-list-filters.service";

@Component({
  selector: "app-new-item-dropdown",
  templateUrl: "new-item-dropdown-v2.component.html",
  standalone: true,
  imports: [NoItemsModule, JslibModule, CommonModule, ButtonModule, RouterLink, MenuModule],
})
export class NewItemDropdownV2Component implements OnInit, OnDestroy {
  private selectedVaultId: string | null | undefined = null;

  cipherType = CipherType;

  constructor(
    private router: Router,
    vaultPopupListFiltersService: VaultPopupListFiltersService,
  ) {
    vaultPopupListFiltersService.filters$.pipe(takeUntilDestroyed()).subscribe((filters) => {
      this.selectedVaultId =
        filters.organization?.id !== MY_VAULT_ID ? filters.organization?.id : null;
    });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  newItemNavigate(type: CipherType) {
    const selectedVault = this.selectedVaultId;

    void this.router.navigate(["/add-cipher"], {
      queryParams: { type: type, isNew: true, selectedVault },
    });
  }
}
