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

  @HostBinding("attr.aria-describedby")
  get ariaDescribedBy() {
    return this._ariaDescribedBy;
  }
  set ariaDescribedBy(value: string) {
    this._ariaDescribedBy = value;
  }
  private _ariaDescribedBy: string;

  isDisabled(): boolean {
    return this.buttonComponent?.disabled;
  }
}
