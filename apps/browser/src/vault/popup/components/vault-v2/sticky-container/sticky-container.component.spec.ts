import { ComponentFixture, TestBed } from "@angular/core/testing";

import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

import { StickyContainerComponent } from "./sticky-container.component";

describe("StickyContainerComponent", () => {
  let component: StickyContainerComponent;
  let fixture: ComponentFixture<StickyContainerComponent>;
  let getElementByIdSpy: jest.SpyInstance;
  let scrollContainer: HTMLDivElement;

  beforeEach(async () => {
    jest.useFakeTimers();
    scrollContainer = document.createElement("div");
    getElementByIdSpy = jest.spyOn(document, "getElementById").mockReturnValue(scrollContainer);

    await TestBed.configureTestingModule({
      imports: [StickyContainerComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StickyContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    jest.runAllTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("gets the element by id `PopupPageComponent.ScrollableContainerId`", () => {
    expect(getElementByIdSpy).toHaveBeenCalledWith(PopupPageComponent.ScrollableContainerId);
  });

  it("sets stuck to true when the scroll top is greater than 0", () => {
    scrollContainer.scrollTop = 1;

    scrollContainer.dispatchEvent(new Event("scroll"));

    expect(component.stuck).toBe(true);
  });

  it("sets stuck to false when the scroll top is 0", () => {
    scrollContainer.scrollTop = 0;

    scrollContainer.dispatchEvent(new Event("scroll"));

    expect(component.stuck).toBe(false);
  });
});
