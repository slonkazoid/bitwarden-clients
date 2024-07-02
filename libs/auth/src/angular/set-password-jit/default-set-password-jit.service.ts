import { firstValueFrom } from "rxjs";

import { InternalUserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { SetPasswordRequest } from "@bitwarden/common/auth/models/request/set-password.request";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";

import { PasswordInputResult } from "../input-password/password-input-result";

import { SetPasswordJitService } from "./set-password-jit.service.abstraction";

export class DefaultSetPasswordJitService implements SetPasswordJitService {
  constructor(
    protected apiService: ApiService,
    protected cryptoService: CryptoService,
    protected kdfConfigService: KdfConfigService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
  ) {}

  async setPassword(
    passwordInputResult: PasswordInputResult,
    orgSsoIdentifier: string,
    resetPasswordAutoEnroll: boolean,
    userId: UserId,
  ): Promise<void> {
    const { masterKey, masterKeyHash, localMasterKeyHash, hint, kdfConfig } = passwordInputResult;

    const protectedUserKey = await this.makeProtectedUserKey(masterKey, userId);

    // Since this is an existing JIT provisioned user in a MP encryption org setting first password,
    // they will not already have a user asymmetric key pair so must create it for them.
    const newKeyPair = await this.cryptoService.makeKeyPair(protectedUserKey[0]);
    const keysRequest = new KeysRequest(newKeyPair[0], newKeyPair[1].encryptedString);

    const request = new SetPasswordRequest(
      masterKeyHash,
      protectedUserKey[1].encryptedString,
      hint,
      orgSsoIdentifier,
      keysRequest,
      kdfConfig.kdfType, // always PBKDF2
      kdfConfig.iterations,
    );

    try {
      await this.apiService.setPassword(request);

      // Clear force set password reason to allow navigation back to vault.
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.None,
        userId,
      );

      // User now has a password so update account decryption options in state
      const userDecryptionOpts = await firstValueFrom(
        this.userDecryptionOptionsService.userDecryptionOptions$,
      );
      userDecryptionOpts.hasMasterPassword = true;
      await this.userDecryptionOptionsService.setUserDecryptionOptions(userDecryptionOpts);
      await this.kdfConfigService.setKdfConfig(userId, kdfConfig);
      await this.masterPasswordService.setMasterKey(masterKey, userId);
      await this.cryptoService.setUserKey(protectedUserKey[0], userId);

      if (newKeyPair !== null) {
        await this.cryptoService.setPrivateKey(newKeyPair[1].encryptedString, userId);
      }

      await this.masterPasswordService.setMasterKeyHash(localMasterKeyHash, userId);
    } catch (e) {
      // TODO-rr-bw
    }
  }

  private async makeProtectedUserKey(
    masterKey: MasterKey,
    userId: UserId,
  ): Promise<[UserKey, EncString]> {
    let protectedUserKey: [UserKey, EncString] = null;

    const userKey = await firstValueFrom(this.cryptoService.userKey$(userId));

    if (userKey == null) {
      protectedUserKey = await this.cryptoService.makeUserKey(masterKey);
    } else {
      protectedUserKey = await this.cryptoService.encryptUserKeyWithMasterKey(masterKey);
    }

    return protectedUserKey;
  }

  onSetPasswordSuccess(): void | Promise<void> {
    // override in client-specific service
  }
}
