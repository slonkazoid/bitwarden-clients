import { DIALOG_DATA, DialogConfig } from "@angular/cdk/dialog";
import { Component, EventEmitter, Inject, Output } from "@angular/core";
import { FormArray, FormBuilder, FormControl, FormGroup } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { UpdateTwoFactorYubioOtpRequest } from "@bitwarden/common/auth/models/request/update-two-factor-yubio-otp.request";
import { TwoFactorYubiKeyResponse } from "@bitwarden/common/auth/models/response/two-factor-yubi-key.response";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { TwoFactorBaseComponent } from "./two-factor-base.component";

interface Key {
  key: string;
  existingKey: string;
}

@Component({
  selector: "app-two-factor-yubikey",
  templateUrl: "two-factor-yubikey.component.html",
})
export class TwoFactorYubiKeyComponent extends TwoFactorBaseComponent {
  @Output() onChangeStatus = new EventEmitter<boolean>();
  type = TwoFactorProviderType.Yubikey;
  keyValues: Key[];
  nfc = false;

  formPromise: Promise<TwoFactorYubiKeyResponse>;
  disablePromise: Promise<unknown>;

  override componentName = "app-two-factor-yubikey";
  formGroup: FormGroup<{ keys: FormArray<FormControl<any>>; nfc: FormControl<any> }>;

  constructor(
    @Inject(DIALOG_DATA) protected data: AuthResponse<TwoFactorYubiKeyResponse>,
    apiService: ApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService,
    private formBuilder: FormBuilder,
  ) {
    super(
      apiService,
      i18nService,
      platformUtilsService,
      logService,
      userVerificationService,
      dialogService,
    );
    this.auth(data);
  }

  get keyPass() {
    return this.formGroup.controls.keys.controls;
  }

  ngOnInit() {
    this.formGroup = this.formBuilder.group({
      keys: this.formBuilder.array([]),
      nfc: this.formBuilder.control(this.nfc),
    });
    this.patch();
  }

  patch() {
    const control = <FormArray>this.formGroup.get("keys");
    this.keyValues.forEach((val) => {
      control.push(this.patchValues(val.key, val.existingKey));
    });
  }

  patchValues(key: string, existingKey: string) {
    return this.formBuilder.group({
      key: [key],
      existingKey: [existingKey],
    });
  }

  auth(authResponse: AuthResponse<TwoFactorYubiKeyResponse>) {
    super.auth(authResponse);
    this.processResponse(authResponse.response);
  }

  submit = async () => {
    const keys = this.formGroup.controls.keys.value;
    const request = await this.buildRequestModel(UpdateTwoFactorYubioOtpRequest);
    request.key1 = keys != null && keys.length > 0 ? keys[0].key : null;
    request.key2 = keys != null && keys.length > 1 ? keys[1].key : null;
    request.key3 = keys != null && keys.length > 2 ? keys[2].key : null;
    request.key4 = keys != null && keys.length > 3 ? keys[3].key : null;
    request.key5 = keys != null && keys.length > 4 ? keys[4].key : null;
    request.nfc = this.formGroup.value.nfc;

    return this.submitForm(request);
  };

  private submitForm(request: UpdateTwoFactorYubioOtpRequest) {
    return super.enable(async () => {
      this.formPromise = this.apiService.putTwoFactorYubiKey(request);
      const response = await this.formPromise;
      await this.processResponse(response);
      this.platformUtilsService.showToast("success", null, this.i18nService.t("yubikeysUpdated"));
    });
  }

  disable() {
    return super.disable(this.disablePromise);
  }

  remove(key: Key) {
    key.existingKey = null;
    key.key = null;
  }

  private processResponse(response: TwoFactorYubiKeyResponse) {
    this.enabled = response.enabled;
    this.onChangeStatus.emit(this.enabled);

    this.keyValues = [
      { key: response.key1, existingKey: this.padRight(response.key1) },
      { key: response.key2, existingKey: this.padRight(response.key2) },
      { key: response.key3, existingKey: this.padRight(response.key3) },
      { key: response.key4, existingKey: this.padRight(response.key4) },
      { key: response.key5, existingKey: this.padRight(response.key5) },
    ];
    this.nfc = response.nfc || !response.enabled;
  }

  private padRight(str: string, character = "•", size = 44) {
    if (str == null || character == null || str.length >= size) {
      return str;
    }
    const max = (size - str.length) / character.length;
    for (let i = 0; i < max; i++) {
      str += character;
    }
    return str;
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<AuthResponse<TwoFactorYubiKeyResponse>>,
  ) {
    return dialogService.open<boolean>(TwoFactorYubiKeyComponent, config);
  }
}
