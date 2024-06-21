import { Directive, HostBinding, Input, Optional } from "@angular/core";

import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";

@Directive({
  selector: "[bitPrefix]",
})
export class BitPrefixDirective {
  constructor(@Optional() private buttonComponent: ButtonLikeAbstraction) {}

  @HostBinding("class") @Input() get classList() {
    return ["last:tw-mr-1", "tw-text-muted"];
  }

  isDisabled(): boolean {
    return this.buttonComponent?.disabled;
  }
}
