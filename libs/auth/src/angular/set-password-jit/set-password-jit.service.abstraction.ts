import { UserId } from "@bitwarden/common/types/guid";

import { PasswordInputResult } from "../input-password/password-input-result";

export abstract class SetPasswordJitService {
  setPassword: (
    passwordInputResult: PasswordInputResult,
    orgSsoIdentifier: string,
    resetPasswordAutoEnroll: boolean,
    userId: UserId,
  ) => Promise<void>;
  onSetPasswordSuccess: () => Promise<void> | void;
}
