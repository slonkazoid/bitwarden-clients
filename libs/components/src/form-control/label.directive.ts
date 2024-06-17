import { Directive, ElementRef } from "@angular/core";

@Directive({
  selector: "bit-label",
})
export class BitLabel {
  constructor(private elementRef: ElementRef<HTMLInputElement>) {}

  get labelText() {
    return this.elementRef.nativeElement.textContent;
  }
}
