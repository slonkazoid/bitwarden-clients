import { Directive, HostBinding, Input, Optional } from "@angular/core";

import { BitFormFieldComponent } from "./form-field.component";

@Directive({
  selector: "[bitPrefix]",
})
export class BitPrefixDirective {
  @HostBinding("class") @Input() get classList() {
    return ["last:tw-mr-1", "tw-text-muted"];
  }

  @HostBinding("attr.aria-describedby")
  get ariaDescribedBy() {
    return this.parentFormField?.label?.id || null;
  }

  constructor(@Optional() private parentFormField: BitFormFieldComponent) {}
}
