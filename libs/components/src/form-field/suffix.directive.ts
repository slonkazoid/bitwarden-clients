import { Directive, Optional } from "@angular/core";

import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";

@Directive({
  selector: "[bitSuffix]",
})
export class BitSuffixDirective {
  constructor(@Optional() private buttonComponent: ButtonLikeAbstraction) {}

  isDisabled(): boolean {
    return this.buttonComponent?.disabled;
  }
}
