import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptedString, EncString } from "@bitwarden/common/platform/models/domain/enc-string";

import { PasswordInputResult } from "../../../angular";
import { RegistrationFinishServiceAbstraction } from "../../abstractions/registration-finish.service";

import { DefaultRegistrationFinishService } from "./default-registration-finish.service";

// TODO: move this to web

export class WebRegistrationFinishService
  extends DefaultRegistrationFinishService
  implements RegistrationFinishServiceAbstraction
{
  constructor(
    protected cryptoService: CryptoService,
    protected accountApiService: AccountApiService,
    private acceptOrgInviteService: AcceptOrgInviteService,
  ) {
    super(cryptoService, accountApiService);
  }

  override async buildRegisterRequest(
    email: string,
    emailVerificationToken: string,
    passwordInputResult: PasswordInputResult,
    encryptedUserKey: EncryptedString,
    userAsymmetricKeys: [string, EncString],
  ): Promise<RegisterFinishRequest> {
    const userAsymmetricKeysRequest = new KeysRequest(
      userAsymmetricKeys[0],
      userAsymmetricKeys[1].encryptedString,
    );

    const registerRequest = new RegisterFinishRequest(
      email,
      emailVerificationToken,
      passwordInputResult.masterKeyHash,
      passwordInputResult.hint,
      encryptedUserKey,
      userAsymmetricKeysRequest,
      passwordInputResult.kdfConfig.kdfType,
      passwordInputResult.kdfConfig.iterations,
    );

    // web specific logic

    // Org invites are deep linked. Non-existent accounts are redirected to the register page.
    // Org user id and token are included here only for validation and two factor purposes.
    const orgInvite = await acceptOrgInviteService.getOrganizationInvite();
    if (orgInvite != null) {
      registerRequest.organizationUserId = orgInvite.organizationUserId;
      registerRequest.orgInviteToken = orgInvite.token;
    }
    // Invite is accepted after login (on deep link redirect).

    return registerRequest;
  }
}
