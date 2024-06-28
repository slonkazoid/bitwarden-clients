import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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
export class IdentityComponent {
  @Input() isEdit: boolean;

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

  constructor(private formBuilder: FormBuilder) {}
}
