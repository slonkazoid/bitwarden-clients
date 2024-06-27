import { Directive, ElementRef, HostBinding, Input } from "@angular/core";

// Increments for each instance of this component
let nextId = 0;

@Directive({
  selector: "bit-label",
})
export class BitLabel {
  constructor(private elementRef: ElementRef<HTMLInputElement>) {}

  get width() {
    return this.elementRef.nativeElement.getBoundingClientRect().width;
  }

  @HostBinding() @Input() id = `bit-label-${nextId++}`;
}
