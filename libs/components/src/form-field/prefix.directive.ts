import { Directive, HostBinding, Input, OnInit, Optional } from "@angular/core";

import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";

export const PrefixClasses = [
  // "tw-bg-background-alt",
  // "tw-border",
  // "tw-border-solid",
  // "tw-border-secondary-500",
  "tw-text-muted",
  "!tw-px-0.5",
  "!tw-py-0.5",
  // "tw-rounded-none",
];

export const PrefixButtonClasses = [
  "tw-bg-transparent",
  "!tw-border",
  "!tw-border-transparent",
  "tw-border-solid",
  "!tw-rounded-lg",

  "hover:tw-bg-transparent",
  "hover:!tw-border",
  "hover:!tw-border-primary-500",

  "disabled:tw-opacity-100",
  "disabled:tw-bg-secondary-100",
  "disabled:hover:tw-bg-secondary-100",
  "disabled:hover:tw-text-muted",

  // "focus-visible:tw-border-primary-700",
  "focus-visible:tw-ring-2",
  // "focus-visible:tw-ring-inset",
  "focus-visible:tw-ring-offset-0",
  "focus-visible:tw-ring-primary-500",
  "focus-visible:tw-z-10",
];

export const PrefixStaticContentClasses = ["tw-block"];

@Directive({
  selector: "[bitPrefix]",
})
export class BitPrefixDirective implements OnInit {
  constructor(@Optional() private buttonComponent: ButtonLikeAbstraction) {}

  @HostBinding("class") @Input() get classList() {
    return PrefixClasses.concat([
      // "tw-border-r-0",
      // "first:tw-rounded-l-lg",
      // "focus-visible:tw-border-r",
      // "focus-visible:tw-mr-[-1px]",
    ]).concat(this.buttonComponent != undefined ? PrefixButtonClasses : PrefixStaticContentClasses);
  }

  ngOnInit(): void {
    this.buttonComponent?.setButtonType("unstyled");
  }
}
