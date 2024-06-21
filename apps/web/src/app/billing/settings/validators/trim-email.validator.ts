import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

export function trimEmailValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const trimmedValue = control.value.trim();
    if (trimmedValue !== control.value) {
      control.setValue(trimmedValue);
    }
    return null;
  };
}
