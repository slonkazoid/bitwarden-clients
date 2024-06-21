import { Directive, HostBinding, Input, Optional } from "@angular/core";

import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";

@Directive({
  selector: "[bitSuffix]",
})
export class BitSuffixDirective {
  constructor(@Optional() private buttonComponent: ButtonLikeAbstraction) {}

  @HostBinding("class") @Input() get classList() {
    return ["tw-text-muted"];
  }

  isDisabled(): boolean {
    return this.buttonComponent?.disabled;
  }
}
