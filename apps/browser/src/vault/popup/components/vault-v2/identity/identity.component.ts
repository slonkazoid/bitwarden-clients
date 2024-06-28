import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  SelectModule,
} from "@bitwarden/components";

@Component({
  standalone: true,
  selector: "app-identity",
  templateUrl: "./identity.component.html",
  imports: [
    CommonModule,
    ButtonModule,
    JslibModule,
    ReactiveFormsModule,
    SectionComponent,
    SectionHeaderComponent,
    CardComponent,
    FormFieldModule,
    IconButtonModule,
    SelectModule,
  ],
})
export class IdentityComponent implements OnInit {
  @Input() cipherId: string;
  cipher: CipherView;
  identityTitleOptions: any[];

  protected identityForm = this.formBuilder.group({
    title: [null],
    firstName: [""],
    lastName: [""],
    username: [""],
    company: [""],
    ssn: [""],
    passportNumber: [""],
    licenseNumber: [""],
    email: [""],
    phone: [""],
    address1: [""],
    address2: [""],
    address3: [""],
    cityTown: [""],
    stateProvince: [""],
    zipPostalCode: [""],
    country: [""],
  });

  constructor(
    private formBuilder: FormBuilder,
    private cipherService: CipherService,
    private i18nService: I18nService,
  ) {
    this.identityTitleOptions = [
      { name: "-- " + i18nService.t("select") + " --", value: null },
      { name: i18nService.t("mr"), value: i18nService.t("mr") },
      { name: i18nService.t("mrs"), value: i18nService.t("mrs") },
      { name: i18nService.t("ms"), value: i18nService.t("ms") },
      { name: i18nService.t("mx"), value: i18nService.t("mx") },
      { name: i18nService.t("dr"), value: i18nService.t("dr") },
    ];
  }

  async ngOnInit() {
    if (this.cipherId) {
      await this.getCipherData(this.cipherId);
      this.populateFormData();
    }
  }

  async getCipherData(id: string) {
    const cipher = await this.cipherService.get(id);
    this.cipher = await cipher.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipher),
    );
  }

  populateFormData() {
    const { identity } = this.cipher;
    this.identityForm.setValue({
      title: identity.title,
      firstName: identity.firstName,
      lastName: identity.lastName,
      username: identity.username,
      company: identity.company,
      ssn: identity.ssn,
      passportNumber: identity.passportNumber,
      licenseNumber: identity.licenseNumber,
      email: identity.email,
      phone: identity.phone,
      address1: identity.address1,
      address2: identity.address2,
      address3: identity.address3,
      cityTown: identity.city,
      stateProvince: identity.state,
      zipPostalCode: identity.postalCode,
      country: identity.country,
    });
  }
}
