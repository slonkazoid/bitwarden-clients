import { Directive, ElementRef, HostBinding, Input } from "@angular/core";

// Increments for each instance of this component
let nextId = 0;

@Directive({
  selector: "bit-label",
})
export class BitLabel {
  constructor(private elementRef: ElementRef<HTMLInputElement>) {}

  get labelText() {
    return this.elementRef.nativeElement.textContent;
  }

  @HostBinding() @Input() id = `bit-label-${nextId++}`;
}
