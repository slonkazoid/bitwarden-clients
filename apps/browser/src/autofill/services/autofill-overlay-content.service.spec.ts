import { mock } from "jest-mock-extended";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AutofillOverlayVisibility, EVENTS } from "@bitwarden/common/autofill/constants";

import AutofillInit from "../content/autofill-init";
import {
  AutofillOverlayElement,
  MAX_SUB_FRAME_DEPTH,
  RedirectFocusDirection,
} from "../enums/autofill-overlay.enum";
import AutofillField from "../models/autofill-field";
import AutofillForm from "../models/autofill-form";
import AutofillPageDetails from "../models/autofill-page-details";
import { createAutofillFieldMock } from "../spec/autofill-mocks";
import { flushPromises, postWindowMessage, sendMockExtensionMessage } from "../spec/testing-utils";
import { ElementWithOpId, FormFieldElement } from "../types";

import { AutoFillConstants } from "./autofill-constants";
import { AutofillOverlayContentService } from "./autofill-overlay-content.service";
import { InlineMenuFieldQualificationService } from "./inline-menu-field-qualification.service";

const defaultWindowReadyState = document.readyState;
const defaultDocumentVisibilityState = document.visibilityState;
describe("AutofillOverlayContentService", () => {
  let autofillInit: AutofillInit;
  let inlineMenuFieldQualificationService: InlineMenuFieldQualificationService;
  let autofillOverlayContentService: AutofillOverlayContentService;
  let sendExtensionMessageSpy: jest.SpyInstance;
  const sendResponseSpy = jest.fn();

  beforeEach(() => {
    inlineMenuFieldQualificationService = new InlineMenuFieldQualificationService();
    autofillOverlayContentService = new AutofillOverlayContentService(
      inlineMenuFieldQualificationService,
    );
    autofillInit = new AutofillInit(autofillOverlayContentService);
    autofillInit.init();
    sendExtensionMessageSpy = jest
      .spyOn(autofillOverlayContentService as any, "sendExtensionMessage")
      .mockResolvedValue(undefined);
    Object.defineProperty(document, "readyState", {
      value: defaultWindowReadyState,
      writable: true,
    });
    Object.defineProperty(document, "visibilityState", {
      value: defaultDocumentVisibilityState,
      writable: true,
    });
    Object.defineProperty(document, "activeElement", {
      value: null,
      writable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 1080,
      writable: true,
    });
    Object.defineProperty(window, "top", {
      value: window,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("init", () => {
    let setupGlobalEventListenersSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.spyOn(document, "addEventListener");
      jest.spyOn(window, "addEventListener");
      setupGlobalEventListenersSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "setupGlobalEventListeners",
      );
    });

    it("sets up a DOMContentLoaded event listener that triggers setting up the mutation observers", () => {
      Object.defineProperty(document, "readyState", {
        value: "loading",
        writable: true,
      });

      autofillOverlayContentService.init();

      expect(document.addEventListener).toHaveBeenCalledWith(
        "DOMContentLoaded",
        setupGlobalEventListenersSpy,
      );
      expect(setupGlobalEventListenersSpy).not.toHaveBeenCalled();
    });

    it("sets up a visibility change listener for the DOM", () => {
      const handleVisibilityChangeEventSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "handleVisibilityChangeEvent",
      );

      autofillOverlayContentService.init();

      expect(document.addEventListener).toHaveBeenCalledWith(
        "visibilitychange",
        handleVisibilityChangeEventSpy,
      );
    });

    it("sets up a focus out listener for the window", () => {
      const handleFormFieldBlurEventSpy = jest.spyOn(
        autofillOverlayContentService as any,
        "handleFormFieldBlurEvent",
      );

      autofillOverlayContentService.init();

      expect(window.addEventListener).toHaveBeenCalledWith("focusout", handleFormFieldBlurEventSpy);
    });
  });

  describe("setupInlineMenu", () => {
    let autofillFieldElement: ElementWithOpId<FormFieldElement>;
    let autofillFieldData: AutofillField;
    let pageDetailsMock: AutofillPageDetails;

    beforeEach(() => {
      document.body.innerHTML = `
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      `;

      autofillFieldElement = document.getElementById(
        "username-field",
      ) as ElementWithOpId<FormFieldElement>;
      autofillFieldElement.opid = "op-1";
      jest.spyOn(autofillFieldElement, "addEventListener");
      jest.spyOn(autofillFieldElement, "removeEventListener");
      autofillFieldData = createAutofillFieldMock({
        opid: "username-field",
        form: "validFormId",
        placeholder: "username",
        elementNumber: 1,
      });
      const passwordFieldData = createAutofillFieldMock({
        opid: "password-field",
        form: "validFormId",
        elementNumber: 2,
        autocompleteType: "current-password",
        type: "password",
      });
      pageDetailsMock = mock<AutofillPageDetails>({
        forms: { validFormId: mock<AutofillForm>() },
        fields: [autofillFieldData, passwordFieldData],
      });
    });

    describe("skips setup for ignored form fields", () => {
      beforeEach(() => {
        autofillFieldData = mock<AutofillField>({
          type: "text",
          htmlName: "username",
          htmlID: "username",
          placeholder: "username",
        });
      });

      it("ignores fields that are part of the ExcludedInlineMenuTypes", () => {
        AutoFillConstants.ExcludedInlineMenuTypes.forEach(async (excludedType) => {
          autofillFieldData.type = excludedType;

          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
        });
      });

      it("ignores fields that do not appear as a login field", async () => {
        autofillFieldData.htmlName = "another-type-of-field";
        autofillFieldData.htmlID = "another-type-of-field";
        autofillFieldData.placeholder = "another-type-of-field";

        await autofillOverlayContentService.setupInlineMenu(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
      });
    });

    it("skips setup on fields that have been previously set up", async () => {
      autofillOverlayContentService["formFieldElements"].add(autofillFieldElement);

      await autofillOverlayContentService.setupInlineMenu(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );

      expect(autofillFieldElement.addEventListener).not.toHaveBeenCalled();
    });

    describe("identifies the overlay visibility setting", () => {
      it("defaults the overlay visibility setting to `OnFieldFocus` if a value is not set", async () => {
        sendExtensionMessageSpy.mockResolvedValueOnce(undefined);
        autofillOverlayContentService["inlineMenuVisibility"] = undefined;

        await autofillOverlayContentService.setupInlineMenu(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("getAutofillInlineMenuVisibility");
        expect(autofillOverlayContentService["inlineMenuVisibility"]).toEqual(
          AutofillOverlayVisibility.OnFieldFocus,
        );
      });

      it("sets the overlay visibility setting to the value returned from the background script", async () => {
        sendExtensionMessageSpy.mockResolvedValueOnce(AutofillOverlayVisibility.OnFieldFocus);
        autofillOverlayContentService["inlineMenuVisibility"] = undefined;

        await autofillOverlayContentService.setupInlineMenu(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillOverlayContentService["inlineMenuVisibility"]).toEqual(
          AutofillOverlayVisibility.OnFieldFocus,
        );
      });
    });

    describe("sets up form field element listeners", () => {
      it("removes all cached event listeners from the form field element", async () => {
        jest.spyOn(autofillFieldElement, "removeEventListener");
        const inputHandler = jest.fn();
        const clickHandler = jest.fn();
        const focusHandler = jest.fn();
        autofillOverlayContentService["eventHandlersMemo"] = {
          "op-1-username-field-input-handler": inputHandler,
          "op-1-username-field-click-handler": clickHandler,
          "op-1-username-field-focus-handler": focusHandler,
        };

        await autofillOverlayContentService.setupInlineMenu(
          autofillFieldElement,
          autofillFieldData,
          pageDetailsMock,
        );

        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          1,
          "focus",
          expect.any(Function),
        );
        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          2,
          "input",
          inputHandler,
        );
        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          3,
          "click",
          clickHandler,
        );
        expect(autofillFieldElement.removeEventListener).toHaveBeenNthCalledWith(
          4,
          "focus",
          focusHandler,
        );
      });

      describe("form field blur event listener", () => {
        beforeEach(async () => {
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
        });

        it("sends a message to the background to update the isFieldCurrentlyFocused value to `false`", async () => {
          autofillFieldElement.dispatchEvent(new Event("blur"));

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateIsFieldCurrentlyFocused", {
            isFieldCurrentlyFocused: false,
          });
        });

        it("sends a message to the background to check if the overlay is focused", () => {
          autofillFieldElement.dispatchEvent(new Event("blur"));

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("checkAutofillInlineMenuFocused");
        });
      });

      describe("form field keyup event listener", () => {
        beforeEach(async () => {
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          jest.spyOn(globalThis.customElements, "define").mockImplementation();
        });

        it("closes the autofill inline menu when the `Escape` key is pressed", () => {
          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Escape" }));

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
            forceCloseInlineMenu: true,
          });
        });

        it("repositions the overlay when autofill is not currently filling and the `Enter` key is pressed", async () => {
          const handleOverlayRepositionEventSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "handleOverlayRepositionEvent",
          );
          jest
            .spyOn(autofillOverlayContentService as any, "isFieldCurrentlyFilling")
            .mockResolvedValue(false);

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));
          await flushPromises();

          expect(handleOverlayRepositionEventSpy).toHaveBeenCalled();
        });

        it("does not reposition the overlay when autofill is currently filling and the `Enter` key is pressed", async () => {
          const handleOverlayRepositionEventSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "handleOverlayRepositionEvent",
          );
          jest
            .spyOn(autofillOverlayContentService as any, "isFieldCurrentlyFilling")
            .mockResolvedValue(true);

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "Enter" }));
          await flushPromises();

          expect(handleOverlayRepositionEventSpy).not.toHaveBeenCalled();
        });

        it("opens the overlay list and focuses it after a delay if it is not visible when the `ArrowDown` key is pressed", async () => {
          jest.useFakeTimers();
          const updateMostRecentlyFocusedFieldSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "updateMostRecentlyFocusedField",
          );
          const openAutofillOverlaySpy = jest.spyOn(
            autofillOverlayContentService as any,
            "openInlineMenu",
          );
          jest
            .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
            .mockResolvedValue(false);

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowDown" }));
          await flushPromises();

          expect(updateMostRecentlyFocusedFieldSpy).toHaveBeenCalledWith(autofillFieldElement);
          expect(openAutofillOverlaySpy).toHaveBeenCalledWith({
            isOpeningFullInlineMenu: true,
          });
          expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith("focusAutofillInlineMenuList");

          jest.advanceTimersByTime(150);

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("focusAutofillInlineMenuList");
        });

        it("focuses the overlay list when the `ArrowDown` key is pressed", async () => {
          jest
            .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
            .mockResolvedValue(true);

          autofillFieldElement.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowDown" }));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("focusAutofillInlineMenuList");
        });
      });

      describe("form field input change event listener", () => {
        beforeEach(() => {
          jest.spyOn(globalThis.customElements, "define").mockImplementation();
        });

        it("ignores span elements that trigger the listener", async () => {
          const spanAutofillFieldElement = document.createElement(
            "span",
          ) as ElementWithOpId<HTMLSpanElement>;
          jest.spyOn(autofillOverlayContentService as any, "storeModifiedFormElement");

          await autofillOverlayContentService.setupInlineMenu(
            spanAutofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          spanAutofillFieldElement.dispatchEvent(new Event("input"));

          expect(autofillOverlayContentService["storeModifiedFormElement"]).not.toHaveBeenCalled();
        });

        it("sets the field as the most recently focused form field element", async () => {
          autofillOverlayContentService["mostRecentlyFocusedField"] =
            mock<ElementWithOpId<FormFieldElement>>();

          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("input"));
          await flushPromises();

          expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toEqual(
            autofillFieldElement,
          );
        });

        it("stores the field as a user filled field if the form field data indicates that it is for a username", async () => {
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));

          expect(autofillOverlayContentService["userFilledFields"].username).toEqual(
            autofillFieldElement,
          );
        });

        it("stores the field as a user filled field if the form field is of type password", async () => {
          const passwordFieldElement = document.getElementById(
            "password-field",
          ) as ElementWithOpId<FormFieldElement>;

          await autofillOverlayContentService.setupInlineMenu(
            passwordFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          passwordFieldElement.dispatchEvent(new Event("input"));

          expect(autofillOverlayContentService["userFilledFields"].password).toEqual(
            passwordFieldElement,
          );
        });

        it("removes the overlay if the form field element has a value and the user is not authed", async () => {
          jest.spyOn(autofillOverlayContentService as any, "isUserAuthed").mockReturnValue(false);
          (autofillFieldElement as HTMLInputElement).value = "test";

          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
            overlayElement: AutofillOverlayElement.List,
            forceCloseInlineMenu: true,
          });
        });

        it("removes the overlay if the form field element has a value and the overlay ciphers are populated", async () => {
          jest.spyOn(autofillOverlayContentService as any, "isUserAuthed").mockReturnValue(true);
          jest
            .spyOn(autofillOverlayContentService as any, "isInlineMenuCiphersPopulated")
            .mockResolvedValue(true);

          (autofillFieldElement as HTMLInputElement).value = "test";

          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
            overlayElement: AutofillOverlayElement.List,
            forceCloseInlineMenu: true,
          });
        });

        it("opens the autofill inline menu if the form field is empty", async () => {
          jest.spyOn(autofillOverlayContentService as any, "openInlineMenu");
          (autofillFieldElement as HTMLInputElement).value = "";

          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));
          await flushPromises();

          expect(autofillOverlayContentService["openInlineMenu"]).toHaveBeenCalled();
        });

        it("opens the autofill inline menu if the form field is empty and the user is authed", async () => {
          jest.spyOn(autofillOverlayContentService as any, "isUserAuthed").mockReturnValue(true);
          jest.spyOn(autofillOverlayContentService as any, "openInlineMenu");
          (autofillFieldElement as HTMLInputElement).value = "";

          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));
          await flushPromises();

          expect(autofillOverlayContentService["openInlineMenu"]).toHaveBeenCalled();
        });

        it("opens the autofill inline menu if the form field is empty and the overlay ciphers are not populated", async () => {
          jest.spyOn(autofillOverlayContentService as any, "isUserAuthed").mockReturnValue(false);
          jest
            .spyOn(autofillOverlayContentService as any, "isInlineMenuCiphersPopulated")
            .mockResolvedValue(false);
          jest.spyOn(autofillOverlayContentService as any, "openInlineMenu");
          (autofillFieldElement as HTMLInputElement).value = "";

          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillFieldElement.dispatchEvent(new Event("input"));
          await flushPromises();

          expect(autofillOverlayContentService["openInlineMenu"]).toHaveBeenCalled();
        });
      });

      describe("form field click event listener", () => {
        beforeEach(async () => {
          jest
            .spyOn(autofillOverlayContentService as any, "triggerFormFieldFocusedAction")
            .mockImplementation();
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
        });

        it("triggers the field focused handler if the overlay is not visible", async () => {
          autofillFieldElement.dispatchEvent(new Event("click"));
          await flushPromises();

          expect(autofillOverlayContentService["triggerFormFieldFocusedAction"]).toHaveBeenCalled();
        });

        it("skips triggering the field focused handler if the overlay list is visible", () => {
          // Mock resolved value from `isInlineMenuButtonVisible` message
          sendExtensionMessageSpy.mockResolvedValueOnce(true);

          autofillFieldElement.dispatchEvent(new Event("click"));

          expect(
            autofillOverlayContentService["triggerFormFieldFocusedAction"],
          ).not.toHaveBeenCalled();
        });

        it("skips triggering the field focused handler if the overlay button is visible", () => {
          // Mock resolved value from `isInlineMenuButtonVisible` message
          sendExtensionMessageSpy.mockResolvedValueOnce(true);

          autofillFieldElement.dispatchEvent(new Event("click"));

          expect(
            autofillOverlayContentService["triggerFormFieldFocusedAction"],
          ).not.toHaveBeenCalled();
        });
      });

      describe("form field focus event listener", () => {
        let updateMostRecentlyFocusedFieldSpy: jest.SpyInstance;
        let isFieldCurrentlyFillingSpy: jest.SpyInstance;

        beforeEach(() => {
          jest.spyOn(globalThis.customElements, "define").mockImplementation();
          updateMostRecentlyFocusedFieldSpy = jest.spyOn(
            autofillOverlayContentService as any,
            "updateMostRecentlyFocusedField",
          );
          isFieldCurrentlyFillingSpy = jest
            .spyOn(autofillOverlayContentService as any, "isFieldCurrentlyFilling")
            .mockResolvedValue(false);
        });

        it("skips triggering the handler logic if autofill is currently filling", async () => {
          isFieldCurrentlyFillingSpy.mockResolvedValue(true);
          autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
          autofillOverlayContentService["inlineMenuVisibility"] =
            AutofillOverlayVisibility.OnFieldFocus;
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(updateMostRecentlyFocusedFieldSpy).not.toHaveBeenCalled();
        });

        it("updates the most recently focused field", async () => {
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(updateMostRecentlyFocusedFieldSpy).toHaveBeenCalledWith(autofillFieldElement);
          expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toEqual(
            autofillFieldElement,
          );
        });

        it("removes the overlay list if the autofill visibility is set to onClick", async () => {
          autofillOverlayContentService["inlineMenuVisibility"] =
            AutofillOverlayVisibility.OnButtonClick;
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
            overlayElement: AutofillOverlayElement.List,
            forceCloseInlineMenu: true,
          });
        });

        it("removes the overlay list if the form element has a value and the focused field is newly focused", async () => {
          autofillOverlayContentService["mostRecentlyFocusedField"] = document.createElement(
            "input",
          ) as ElementWithOpId<HTMLInputElement>;
          (autofillFieldElement as HTMLInputElement).value = "test";
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
            overlayElement: AutofillOverlayElement.List,
            forceCloseInlineMenu: true,
          });
        });

        it("opens the autofill inline menu if the form element has no value", async () => {
          (autofillFieldElement as HTMLInputElement).value = "";
          autofillOverlayContentService["inlineMenuVisibility"] =
            AutofillOverlayVisibility.OnFieldFocus;
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("openAutofillInlineMenu");
        });

        it("opens the autofill inline menu if the overlay ciphers are not populated and the user is authed", async () => {
          (autofillFieldElement as HTMLInputElement).value = "";
          autofillOverlayContentService["inlineMenuVisibility"] =
            AutofillOverlayVisibility.OnFieldFocus;
          jest.spyOn(autofillOverlayContentService as any, "isUserAuthed").mockReturnValue(true);
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("openAutofillInlineMenu");
        });

        it("updates the overlay button position if the focus event is not opening the overlay", async () => {
          autofillOverlayContentService["inlineMenuVisibility"] =
            AutofillOverlayVisibility.OnFieldFocus;
          (autofillFieldElement as HTMLInputElement).value = "test";
          jest
            .spyOn(autofillOverlayContentService as any, "isInlineMenuCiphersPopulated")
            .mockReturnValue(true);
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillInlineMenuPosition", {
            overlayElement: AutofillOverlayElement.Button,
          });
        });
      });

      describe("hidden form field focus event", () => {
        it("sets up the inline menu listeners if the autofill field data is in the cache", async () => {
          autofillFieldData.viewable = false;
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );

          autofillFieldElement.dispatchEvent(new Event("focus"));
          await flushPromises();

          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.BLUR,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.KEYUP,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.INPUT,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.CLICK,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).toHaveBeenCalledWith(
            EVENTS.FOCUS,
            expect.any(Function),
          );
          expect(autofillFieldElement.removeEventListener).toHaveBeenCalled();
        });

        it("skips setting up the inline menu listeners if the autofill field data is not in the cache", async () => {
          autofillFieldData.viewable = false;
          await autofillOverlayContentService.setupInlineMenu(
            autofillFieldElement,
            autofillFieldData,
            pageDetailsMock,
          );
          autofillOverlayContentService["formFieldElements"].delete(autofillFieldElement);

          autofillFieldElement.dispatchEvent(new Event("focus"));

          expect(autofillFieldElement.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.BLUR,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.KEYUP,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.INPUT,
            expect.any(Function),
          );
          expect(autofillFieldElement.addEventListener).not.toHaveBeenCalledWith(
            EVENTS.CLICK,
            expect.any(Function),
          );
          expect(autofillFieldElement.removeEventListener).toHaveBeenCalled();
        });
      });
    });

    it("triggers the form field focused handler if the current active element in the document is the passed form field", async () => {
      const documentRoot = autofillFieldElement.getRootNode() as Document;
      Object.defineProperty(documentRoot, "activeElement", {
        value: autofillFieldElement,
        writable: true,
      });

      await autofillOverlayContentService.setupInlineMenu(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("openAutofillInlineMenu");
      expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toEqual(
        autofillFieldElement,
      );
    });

    it("sets the most recently focused field to the passed form field element if the value is not set", async () => {
      autofillOverlayContentService["mostRecentlyFocusedField"] = undefined;

      await autofillOverlayContentService.setupInlineMenu(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );

      expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toEqual(
        autofillFieldElement,
      );
    });
  });

  describe("focusMostRecentlyFocusedField", () => {
    it("focuses the most recently focused overlay field", () => {
      const mostRecentlyFocusedField = document.createElement(
        "input",
      ) as ElementWithOpId<HTMLInputElement>;
      autofillOverlayContentService["mostRecentlyFocusedField"] = mostRecentlyFocusedField;
      jest.spyOn(mostRecentlyFocusedField, "focus");

      autofillOverlayContentService["focusMostRecentlyFocusedField"]();

      expect(mostRecentlyFocusedField.focus).toHaveBeenCalled();
    });
  });

  describe("handleOverlayRepositionEvent", () => {
    const repositionEvents = [EVENTS.SCROLL, EVENTS.RESIZE];
    repositionEvents.forEach((repositionEvent) => {
      it(`sends a message trigger overlay reposition message to the background when a ${repositionEvent} event occurs`, async () => {
        globalThis.dispatchEvent(new Event(repositionEvent));
        await flushPromises();

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("triggerAutofillOverlayReposition");
      });
    });
  });

  describe("handleVisibilityChangeEvent", () => {
    beforeEach(() => {
      autofillOverlayContentService["mostRecentlyFocusedField"] =
        mock<ElementWithOpId<FormFieldElement>>();
    });

    it("skips removing the overlay if the document is visible", () => {
      autofillOverlayContentService["handleVisibilityChangeEvent"]();

      expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith("closeAutofillInlineMenu", {
        forceCloseInlineMenu: true,
      });
    });

    it("removes the overlay if the document is not visible", () => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
      });

      autofillOverlayContentService["handleVisibilityChangeEvent"]();

      expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu", {
        forceCloseInlineMenu: true,
      });
    });
  });

  describe("extension onMessage handlers", () => {
    describe("openAutofillInlineMenu message handler", () => {
      let autofillFieldElement: ElementWithOpId<FormFieldElement>;

      beforeEach(() => {
        document.body.innerHTML = `
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      `;

        autofillFieldElement = document.getElementById(
          "username-field",
        ) as ElementWithOpId<FormFieldElement>;
        autofillFieldElement.opid = "op-1";
        autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
      });

      it("skips opening the overlay if a field has not been recently focused", () => {
        autofillOverlayContentService["mostRecentlyFocusedField"] = undefined;

        sendMockExtensionMessage({ command: "openAutofillInlineMenu" });

        expect(sendExtensionMessageSpy).not.toHaveBeenCalled();
      });

      it("focuses the most recent overlay field if the field is not focused", () => {
        jest.spyOn(autofillFieldElement, "getRootNode").mockReturnValue(document);
        Object.defineProperty(document, "activeElement", {
          value: document.createElement("div"),
          writable: true,
        });
        const focusMostRecentOverlayFieldSpy = jest.spyOn(
          autofillOverlayContentService as any,
          "focusMostRecentlyFocusedField",
        );

        sendMockExtensionMessage({
          command: "openAutofillInlineMenu",
          isFocusingFieldElement: true,
        });

        expect(focusMostRecentOverlayFieldSpy).toHaveBeenCalled();
      });

      it("skips focusing the most recent overlay field if the field is already focused", () => {
        jest.spyOn(autofillFieldElement, "getRootNode").mockReturnValue(document);
        Object.defineProperty(document, "activeElement", {
          value: autofillFieldElement,
          writable: true,
        });
        const focusMostRecentOverlayFieldSpy = jest.spyOn(
          autofillOverlayContentService as any,
          "focusMostRecentlyFocusedField",
        );

        sendMockExtensionMessage({
          command: "openAutofillInlineMenu",
          isFocusingFieldElement: true,
        });

        expect(focusMostRecentOverlayFieldSpy).not.toHaveBeenCalled();
      });

      it("stores the user's auth status", () => {
        autofillOverlayContentService["authStatus"] = undefined;

        sendMockExtensionMessage({
          command: "openAutofillInlineMenu",
          authStatus: AuthenticationStatus.Unlocked,
        });

        expect(autofillOverlayContentService["authStatus"]).toEqual(AuthenticationStatus.Unlocked);
      });

      it("opens both autofill inline menu elements", () => {
        autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;

        sendMockExtensionMessage({ command: "openAutofillInlineMenu" });

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillInlineMenuPosition", {
          overlayElement: AutofillOverlayElement.Button,
        });
        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillInlineMenuPosition", {
          overlayElement: AutofillOverlayElement.List,
        });
      });

      it("opens the autofill inline menu button only if overlay visibility is set for onButtonClick", () => {
        autofillOverlayContentService["inlineMenuVisibility"] =
          AutofillOverlayVisibility.OnButtonClick;

        sendMockExtensionMessage({
          command: "openAutofillInlineMenu",
          isOpeningFullInlineMenu: false,
        });

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillInlineMenuPosition", {
          overlayElement: AutofillOverlayElement.Button,
        });
        expect(sendExtensionMessageSpy).not.toHaveBeenCalledWith(
          "updateAutofillInlineMenuPosition",
          {
            overlayElement: AutofillOverlayElement.List,
          },
        );
      });

      it("overrides the onButtonClick visibility setting to open both overlay elements", () => {
        autofillOverlayContentService["inlineMenuVisibility"] =
          AutofillOverlayVisibility.OnButtonClick;

        sendMockExtensionMessage({
          command: "openAutofillInlineMenu",
          isOpeningFullInlineMenu: true,
        });

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillInlineMenuPosition", {
          overlayElement: AutofillOverlayElement.Button,
        });
        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateAutofillInlineMenuPosition", {
          overlayElement: AutofillOverlayElement.List,
        });
      });

      it("sends an extension message requesting an re-collection of page details if they need to update", () => {
        jest.spyOn(autofillOverlayContentService as any, "sendExtensionMessage");
        autofillOverlayContentService.pageDetailsUpdateRequired = true;

        autofillOverlayContentService["openInlineMenu"]();
        sendMockExtensionMessage({ command: "openAutofillInlineMenu" });

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("bgCollectPageDetails", {
          sender: "autofillOverlayContentService",
        });
      });
    });

    describe("addNewVaultItemFromOverlay message handler", () => {
      it("skips sending the message if the overlay list is not visible", async () => {
        jest
          .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
          .mockResolvedValue(false);

        sendMockExtensionMessage({ command: "addNewVaultItemFromOverlay" });
        await flushPromises();

        expect(sendExtensionMessageSpy).not.toHaveBeenCalled();
      });

      it("sends a message that facilitates adding a new vault item with empty fields", async () => {
        jest
          .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
          .mockResolvedValue(true);

        sendMockExtensionMessage({ command: "addNewVaultItemFromOverlay" });
        await flushPromises();

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayAddNewVaultItem", {
          login: {
            username: "",
            password: "",
            uri: "http://localhost/",
            hostname: "localhost",
          },
        });
      });

      it("sends a message that facilitates adding a new vault item with data from user filled fields", async () => {
        document.body.innerHTML = `
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      `;
        const usernameField = document.getElementById(
          "username-field",
        ) as ElementWithOpId<HTMLInputElement>;
        const passwordField = document.getElementById(
          "password-field",
        ) as ElementWithOpId<HTMLInputElement>;
        usernameField.value = "test-username";
        passwordField.value = "test-password";
        jest
          .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
          .mockResolvedValue(true);
        autofillOverlayContentService["userFilledFields"] = {
          username: usernameField,
          password: passwordField,
        };

        sendMockExtensionMessage({ command: "addNewVaultItemFromOverlay" });
        await flushPromises();

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("autofillOverlayAddNewVaultItem", {
          login: {
            username: "test-username",
            password: "test-password",
            uri: "http://localhost/",
            hostname: "localhost",
          },
        });
      });
    });

    describe("unsetMostRecentlyFocusedField message handler", () => {
      it("will reset the mostRecentlyFocusedField value to a null value", () => {
        autofillOverlayContentService["mostRecentlyFocusedField"] =
          mock<ElementWithOpId<FormFieldElement>>();

        sendMockExtensionMessage({
          command: "unsetMostRecentlyFocusedField",
        });

        expect(autofillOverlayContentService["mostRecentlyFocusedField"]).toBeNull();
      });
    });

    describe("messages that trigger a blur of the most recently focused field", () => {
      const messages = [
        "blurMostRecentlyFocusedField",
        "bgUnlockPopoutOpened",
        "bgVaultItemRepromptPopoutOpened",
      ];

      messages.forEach((message, index) => {
        const isClosingInlineMenu = index >= 1;
        it(`will blur the most recently focused field${isClosingInlineMenu ? " and close the inline menu" : ""} when a ${message} message is received`, () => {
          autofillOverlayContentService["mostRecentlyFocusedField"] =
            mock<ElementWithOpId<FormFieldElement>>();

          sendMockExtensionMessage({ command: message });

          expect(autofillOverlayContentService["mostRecentlyFocusedField"].blur).toHaveBeenCalled();

          if (isClosingInlineMenu) {
            expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu");
          }
        });
      });
    });

    describe("redirectAutofillInlineMenuFocusOut message handler", () => {
      let autofillFieldElement: ElementWithOpId<FormFieldElement>;
      let autofillFieldFocusSpy: jest.SpyInstance;
      let findTabsSpy: jest.SpyInstance;
      let previousFocusableElement: HTMLElement;
      let nextFocusableElement: HTMLElement;
      let isInlineMenuListVisibleSpy: jest.SpyInstance;

      beforeEach(() => {
        document.body.innerHTML = `
      <div class="previous-focusable-element" tabindex="0"></div>
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      <div class="next-focusable-element" tabindex="0"></div>
      `;
        autofillFieldElement = document.getElementById(
          "username-field",
        ) as ElementWithOpId<FormFieldElement>;
        autofillFieldElement.opid = "op-1";
        previousFocusableElement = document.querySelector(
          ".previous-focusable-element",
        ) as HTMLElement;
        nextFocusableElement = document.querySelector(".next-focusable-element") as HTMLElement;
        autofillFieldFocusSpy = jest.spyOn(autofillFieldElement, "focus");
        findTabsSpy = jest.spyOn(autofillOverlayContentService as any, "findTabs");
        isInlineMenuListVisibleSpy = jest
          .spyOn(autofillOverlayContentService as any, "isInlineMenuListVisible")
          .mockResolvedValue(true);
        autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
        autofillOverlayContentService["focusableElements"] = [
          previousFocusableElement,
          autofillFieldElement,
          nextFocusableElement,
        ];
      });

      it("skips focusing an element if the overlay is not visible", async () => {
        isInlineMenuListVisibleSpy.mockResolvedValue(false);

        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Next },
        });

        expect(findTabsSpy).not.toHaveBeenCalled();
      });

      it("skips focusing an element if no recently focused field exists", async () => {
        autofillOverlayContentService["mostRecentlyFocusedField"] = undefined;

        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Next },
        });

        expect(findTabsSpy).not.toHaveBeenCalled();
      });

      it("focuses the most recently focused field if the focus direction is `Current`", async () => {
        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Current },
        });
        await flushPromises();

        expect(findTabsSpy).not.toHaveBeenCalled();
        expect(autofillFieldFocusSpy).toHaveBeenCalled();
      });

      it("removes the overlay if the focus direction is `Current`", async () => {
        jest.useFakeTimers();
        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Current },
        });
        await flushPromises();
        jest.advanceTimersByTime(150);

        expect(sendExtensionMessageSpy).toHaveBeenCalledWith("closeAutofillInlineMenu");
      });

      it("finds all focusable tabs if the focusable elements array is not populated", async () => {
        autofillOverlayContentService["focusableElements"] = [];
        findTabsSpy.mockReturnValue([
          previousFocusableElement,
          autofillFieldElement,
          nextFocusableElement,
        ]);

        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Next },
        });
        await flushPromises();

        expect(findTabsSpy).toHaveBeenCalledWith(globalThis.document.body, { getShadowRoot: true });
      });

      it("focuses the previous focusable element if the focus direction is `Previous`", async () => {
        jest.spyOn(previousFocusableElement, "focus");

        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Previous },
        });
        await flushPromises();

        expect(autofillFieldFocusSpy).not.toHaveBeenCalled();
        expect(previousFocusableElement.focus).toHaveBeenCalled();
      });

      it("focuses the next focusable element if the focus direction is `Next`", async () => {
        jest.spyOn(nextFocusableElement, "focus");

        sendMockExtensionMessage({
          command: "redirectAutofillInlineMenuFocusOut",
          data: { direction: RedirectFocusDirection.Next },
        });
        await flushPromises();

        expect(autofillFieldFocusSpy).not.toHaveBeenCalled();
        expect(nextFocusableElement.focus).toHaveBeenCalled();
      });
    });

    describe("updateAutofillInlineMenuVisibility message handler", () => {
      it("updates the inlineMenuVisibility property", () => {
        sendMockExtensionMessage({
          command: "updateAutofillInlineMenuVisibility",
          data: { inlineMenuVisibility: AutofillOverlayVisibility.OnButtonClick },
        });

        expect(autofillOverlayContentService["inlineMenuVisibility"]).toEqual(
          AutofillOverlayVisibility.OnButtonClick,
        );
      });
    });

    describe("getSubFrameOffsets message handler", () => {
      const iframeSource = "https://example.com/";

      beforeEach(() => {
        document.body.innerHTML = `<iframe id="subframe" src="${iframeSource}"></iframe>`;
      });

      it("calculates the sub frame's offsets if a single frame with the referenced url exists", async () => {
        sendMockExtensionMessage(
          {
            command: "getSubFrameOffsets",
            subFrameUrl: iframeSource,
          },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(sendResponseSpy).toHaveBeenCalledWith({
          frameId: undefined,
          left: 2,
          top: 2,
          url: "https://example.com/",
        });
      });

      it("returns null if no iframe is found", async () => {
        document.body.innerHTML = "";
        sendMockExtensionMessage(
          {
            command: "getSubFrameOffsets",
            subFrameUrl: "https://example.com/",
          },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(sendResponseSpy).toHaveBeenCalledWith(null);
      });

      it("returns null if two or more iframes are found with the same src", async () => {
        document.body.innerHTML = `
        <iframe src="${iframeSource}"></iframe>
        <iframe src="${iframeSource}"></iframe>
        `;

        sendMockExtensionMessage(
          {
            command: "getSubFrameOffsets",
            subFrameUrl: iframeSource,
          },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(sendResponseSpy).toHaveBeenCalledWith(null);
      });
    });

    describe("getSubFrameOffsetsFromWindowMessage", () => {
      it("sends a message to the parent to calculate the sub frame positioning", () => {
        jest.spyOn(globalThis.parent, "postMessage").mockImplementation();
        const subFrameId = 10;

        sendMockExtensionMessage({
          command: "getSubFrameOffsetsFromWindowMessage",
          subFrameId,
        });

        expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
          {
            command: "calculateSubFramePositioning",
            subFrameData: {
              url: window.location.href,
              frameId: subFrameId,
              left: 0,
              top: 0,
              parentFrameIds: [],
              subFrameDepth: 0,
            },
          },
          "*",
        );
      });

      describe("calculateSubFramePositioning", () => {
        beforeEach(() => {
          autofillOverlayContentService.init();
          jest.spyOn(globalThis.parent, "postMessage");
          document.body.innerHTML = ``;
        });

        it("destroys the inline menu listeners on the origin frame if the depth exceeds the threshold", async () => {
          document.body.innerHTML = `<iframe id="subframe" src="https://example.com/"></iframe>`;
          const iframe = document.querySelector("iframe") as HTMLIFrameElement;
          const subFrameData = {
            url: "https://example.com/",
            frameId: 10,
            left: 0,
            top: 0,
            parentFrameIds: [1, 2, 3],
            subFrameDepth: MAX_SUB_FRAME_DEPTH,
          };
          sendExtensionMessageSpy.mockResolvedValue(4);

          postWindowMessage(
            { command: "calculateSubFramePositioning", subFrameData },
            "*",
            iframe.contentWindow as any,
          );
          await flushPromises();

          expect(globalThis.parent.postMessage).not.toHaveBeenCalled();
        });

        it("calculates the sub frame offset for the current frame and sends those values to the parent if not in the top frame", async () => {
          Object.defineProperty(window, "top", {
            value: null,
            writable: true,
          });
          document.body.innerHTML = `<iframe id="subframe" src="https://example.com/"></iframe>`;
          const iframe = document.querySelector("iframe") as HTMLIFrameElement;
          const subFrameData = {
            url: "https://example.com/",
            frameId: 10,
            left: 0,
            top: 0,
            parentFrameIds: [1, 2, 3],
            subFrameDepth: 0,
          };

          postWindowMessage(
            { command: "calculateSubFramePositioning", subFrameData },
            "*",
            iframe.contentWindow as any,
          );
          await flushPromises();

          expect(globalThis.parent.postMessage).toHaveBeenCalledWith(
            {
              command: "calculateSubFramePositioning",
              subFrameData: {
                frameId: 10,
                left: expect.any(Number),
                parentFrameIds: [1, 2, 3],
                top: expect.any(Number),
                url: "https://example.com/",
                subFrameDepth: expect.any(Number),
              },
            },
            "*",
          );
        });

        it("posts the calculated sub frame data to the background", async () => {
          document.body.innerHTML = `<iframe id="subframe" src="https://example.com/"></iframe>`;
          const iframe = document.querySelector("iframe") as HTMLIFrameElement;
          const subFrameData = {
            url: "https://example.com/",
            frameId: 10,
            left: 0,
            top: 0,
            parentFrameIds: [1, 2, 3],
            subFrameDepth: expect.any(Number),
          };

          postWindowMessage(
            { command: "calculateSubFramePositioning", subFrameData },
            "*",
            iframe.contentWindow as any,
          );
          await flushPromises();

          expect(sendExtensionMessageSpy).toHaveBeenCalledWith("updateSubFrameData", {
            subFrameData: {
              frameId: 10,
              left: expect.any(Number),
              top: expect.any(Number),
              url: "https://example.com/",
              parentFrameIds: [1, 2, 3, 4],
              subFrameDepth: expect.any(Number),
            },
          });
        });
      });
    });

    describe("checkMostRecentlyFocusedFieldHasValue message handler", () => {
      it("returns true if the most recently focused field has a truthy value", async () => {
        autofillOverlayContentService["mostRecentlyFocusedField"] = mock<
          ElementWithOpId<FormFieldElement>
        >({ value: "test" });

        sendMockExtensionMessage(
          {
            command: "checkMostRecentlyFocusedFieldHasValue",
          },
          mock<chrome.runtime.MessageSender>(),
          sendResponseSpy,
        );
        await flushPromises();

        expect(sendResponseSpy).toHaveBeenCalledWith(true);
      });
    });

    describe("destroyAutofillInlineMenuListeners message handler", () => {
      it("destroys the inline menu listeners", () => {
        jest.spyOn(autofillOverlayContentService, "destroy");

        sendMockExtensionMessage({ command: "destroyAutofillInlineMenuListeners" });

        expect(autofillOverlayContentService.destroy).toHaveBeenCalled();
      });
    });
  });

  describe("destroy", () => {
    let autofillFieldElement: ElementWithOpId<FormFieldElement>;
    let autofillFieldData: AutofillField;
    let pageDetailsMock: AutofillPageDetails;

    beforeEach(() => {
      document.body.innerHTML = `
      <form id="validFormId">
        <input type="text" id="username-field" placeholder="username" />
        <input type="password" id="password-field" placeholder="password" />
      </form>
      `;

      autofillFieldElement = document.getElementById(
        "username-field",
      ) as ElementWithOpId<FormFieldElement>;
      autofillFieldElement.opid = "op-1";
      autofillFieldData = createAutofillFieldMock({
        opid: "username-field",
        form: "validFormId",
        placeholder: "username",
        elementNumber: 1,
      });
      const passwordFieldData = createAutofillFieldMock({
        opid: "password-field",
        form: "validFormId",
        elementNumber: 2,
        autocompleteType: "current-password",
        type: "password",
      });
      pageDetailsMock = mock<AutofillPageDetails>({
        forms: { validFormId: mock<AutofillForm>() },
        fields: [autofillFieldData, passwordFieldData],
      });
      void autofillOverlayContentService.setupInlineMenu(
        autofillFieldElement,
        autofillFieldData,
        pageDetailsMock,
      );
      autofillOverlayContentService["mostRecentlyFocusedField"] = autofillFieldElement;
    });

    it("de-registers all global event listeners", () => {
      jest.spyOn(globalThis.document, "removeEventListener");
      jest.spyOn(globalThis, "removeEventListener");
      jest.spyOn(autofillOverlayContentService as any, "removeOverlayRepositionEventListeners");

      autofillOverlayContentService.destroy();

      expect(globalThis.document.removeEventListener).toHaveBeenCalledWith(
        EVENTS.VISIBILITYCHANGE,
        autofillOverlayContentService["handleVisibilityChangeEvent"],
      );
      expect(globalThis.removeEventListener).toHaveBeenCalledWith(
        EVENTS.FOCUSOUT,
        autofillOverlayContentService["handleFormFieldBlurEvent"],
      );
      expect(
        autofillOverlayContentService["removeOverlayRepositionEventListeners"],
      ).toHaveBeenCalled();
    });

    it("de-registers any event listeners that are attached to the form field elements", () => {
      jest.spyOn(autofillOverlayContentService as any, "removeCachedFormFieldEventListeners");
      jest.spyOn(autofillFieldElement, "removeEventListener");
      jest.spyOn(autofillOverlayContentService["formFieldElements"], "delete");

      autofillOverlayContentService.destroy();

      expect(
        autofillOverlayContentService["removeCachedFormFieldEventListeners"],
      ).toHaveBeenCalledWith(autofillFieldElement);
      expect(autofillFieldElement.removeEventListener).toHaveBeenCalledWith(
        EVENTS.BLUR,
        autofillOverlayContentService["handleFormFieldBlurEvent"],
      );
      expect(autofillFieldElement.removeEventListener).toHaveBeenCalledWith(
        EVENTS.KEYUP,
        autofillOverlayContentService["handleFormFieldKeyupEvent"],
      );
      expect(autofillOverlayContentService["formFieldElements"].delete).toHaveBeenCalledWith(
        autofillFieldElement,
      );
    });
  });
});
