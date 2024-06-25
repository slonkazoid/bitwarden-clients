import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { fromEvent } from "rxjs";

import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

@Component({
  standalone: true,
  selector: "app-sticky-container",
  templateUrl: "./sticky-container.component.html",
  imports: [CommonModule],
})
export class StickyContainerComponent implements AfterViewInit {
  /** True when the `div` is "stuck" in position */
  stuck = false;

  destroyRef = inject(DestroyRef);

  ngAfterViewInit(): void {
    // Use setTimeout to wait a render cycle before subscribing to the scroll event
    setTimeout(() => {
      // The window isn't scrollable in this scenario,
      // so we listen to the scroll event on the `div` itself
      fromEvent(document.getElementById(PopupPageComponent.ScrollableContainerId), "scroll")
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(this.onScroll.bind(this));
    });
  }

  /**
   * Update `stuck` variable based on scroll position of the container
   *
   * Because search/filters are already at the top of the page,
   * any scroll at all means the container should be "stuck"
   */
  private onScroll(e: Event): void {
    const target = e.target as HTMLElement;

    if (target.scrollTop > 0) {
      this.stuck = true;
    } else {
      this.stuck = false;
    }
  }
}
