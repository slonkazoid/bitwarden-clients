import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  CardComponent,
  FormFieldModule,
  IconButtonModule,
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
  ],
})
export class IdentityComponent implements OnInit {
  @Input() cipherId: string;
  cipher: CipherView;

  protected identityForm = this.formBuilder.group({
    title: [],
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
  ) {}

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
