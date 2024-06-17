import { Directive, HostBinding, Input, Optional } from "@angular/core";

import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";

import { PrefixButtonClasses, PrefixClasses, PrefixStaticContentClasses } from "./prefix.directive";

@Directive({
  selector: "[bitSuffix]",
})
export class BitSuffixDirective {
  constructor(@Optional() private buttonComponent: ButtonLikeAbstraction) {}

  @HostBinding("class") @Input() get classList() {
    return PrefixClasses.concat([
      "tw-pl-1",
      "tw-pr-1",
      "last:tw-pr-0",
      // "tw-border-l-0",
      // "last:tw-rounded-r-lg",
      // "focus-visible:tw-border-l",
      // "focus-visible:tw-ml-[-1px]",
    ]).concat(this.buttonComponent != undefined ? PrefixButtonClasses : PrefixStaticContentClasses);
  }

  ngOnInit(): void {
    this.buttonComponent?.setButtonType("unstyled");
  }
}
