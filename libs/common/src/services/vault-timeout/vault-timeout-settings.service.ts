import {
  Observable,
  combineLatest,
  defer,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  from,
  map,
  shareReplay,
  switchMap,
} from "rxjs";

import { VaultTimeoutSettingsService as VaultTimeoutSettingsServiceAbstraction } from "../../abstractions/vault-timeout/vault-timeout-settings.service";
import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../admin-console/enums";
import { Policy } from "../../admin-console/models/domain/policy";
import { TokenService } from "../../auth/abstractions/token.service";
import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { StateService } from "../../platform/abstractions/state.service";
import {
  ActiveUserState,
  KeyDefinition,
  StateProvider,
  VAULT_TIMEOUT_SETTINGS_DISK,
  VAULT_TIMEOUT_SETTINGS_MEMORY,
} from "../../platform/state";
import { UserId } from "../../types/guid";

/**
 * Settings use disk storage and local storage on web so settings can persist after logout.
 */
const VAULT_TIMEOUT_ACTION = new KeyDefinition<VaultTimeoutAction>(
  VAULT_TIMEOUT_SETTINGS_DISK,
  "vaultTimeoutAction",
  {
    deserializer: (vaultTimeoutAction) => vaultTimeoutAction,
  },
);
const VAULT_TIMEOUT = new KeyDefinition<number>(VAULT_TIMEOUT_SETTINGS_DISK, "vaultTimeout", {
  deserializer: (vaultTimeout) => vaultTimeout,
});

const EVER_BEEN_UNLOCKED = new KeyDefinition<boolean>(
  VAULT_TIMEOUT_SETTINGS_MEMORY,
  "everBeenUnlocked",
  {
    deserializer: (everBeenUnlocked) => everBeenUnlocked,
  },
);

/**
 * - DISABLED: No Pin set
 * - PERSISTENT: Pin is set and survives client reset
 * - TRANSIENT: Pin is set and requires password unlock after client reset
 */
export type PinLockType = "DISABLED" | "PERSISTANT" | "TRANSIENT";

export class VaultTimeoutSettingsService implements VaultTimeoutSettingsServiceAbstraction {
  private maxVaultTimeoutPolicy$: Observable<Policy> = this.policyService.policies$.pipe(
    // convert the policies to a single policy stream
    map((policies: Policy[]) =>
      policies.find((policy: Policy) => policy.type === PolicyType.MaximumVaultTimeout),
    ),
    // Only emit if the policy goes from undefined to defined or if the relevant policy data changes.
    filter((policy) => policy !== undefined && policy !== null),
    distinctUntilChanged(
      (prev, curr) => prev.enabled === curr.enabled && prev.data?.action === curr.data?.action,
    ),
  );

  private vaultTimeoutActionState: ActiveUserState<VaultTimeoutAction>;
  vaultTimeoutAction$: Observable<VaultTimeoutAction | null>;

  private vaultTimeoutState: ActiveUserState<number>;
  vaultTimeout$: Observable<number | null>;

  private everBeenUnlockedState: ActiveUserState<boolean>;
  everBeenUnlocked$: Observable<boolean>;

  constructor(
    private cryptoService: CryptoService,
    private tokenService: TokenService,
    private policyService: PolicyService,
    private stateService: StateService,
    private stateProvider: StateProvider,
  ) {
    this.vaultTimeoutActionState = this.stateProvider.getActive(VAULT_TIMEOUT_ACTION);
    this.vaultTimeoutAction$ = combineLatest([
      this.vaultTimeoutActionState.state$,
      this.maxVaultTimeoutPolicy$,
    ]).pipe(
      switchMap(([vaultTimeoutAction, _]) => {
        return from(this.determinePolicyCompliantVaultTimeoutAction(vaultTimeoutAction));
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.vaultTimeoutState = this.stateProvider.getActive(VAULT_TIMEOUT);
    this.vaultTimeout$ = combineLatest([
      this.vaultTimeoutState.state$,
      this.maxVaultTimeoutPolicy$,
    ]).pipe(
      switchMap(([vaultTimeout, _]) => {
        return from(this.determinePolicyCompliantVaultTimeout(vaultTimeout));
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

    this.everBeenUnlockedState = this.stateProvider.getActive(EVER_BEEN_UNLOCKED);
    this.everBeenUnlocked$ = this.everBeenUnlockedState.state$;
  }

  getVaultTimeoutActionByUserId$(userId: UserId) {
    return combineLatest([
      this.stateProvider.getUser(userId, VAULT_TIMEOUT_ACTION).state$,
      this.maxVaultTimeoutPolicy$,
    ]).pipe(
      switchMap(([vaultTimeoutAction, _]) => {
        return from(this.determinePolicyCompliantVaultTimeoutAction(vaultTimeoutAction, userId));
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  async setVaultTimeoutAction(value: VaultTimeoutAction): Promise<void> {
    await this.vaultTimeoutActionState.update((_) => value);
  }

  getVaultTimeoutByUserId$(userId: UserId) {
    return combineLatest([
      this.stateProvider.getUser(userId, VAULT_TIMEOUT).state$,
      this.maxVaultTimeoutPolicy$,
    ]).pipe(
      switchMap(([vaultTimeout, _]) => {
        return from(this.determinePolicyCompliantVaultTimeout(vaultTimeout, userId));
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  async setVaultTimeout(value: number): Promise<void> {
    await this.vaultTimeoutState.update((_) => value);
  }

  getEverBeenUnlockedByUserId$(userId: UserId) {
    return this.stateProvider.getUser(userId, EVER_BEEN_UNLOCKED).state$;
  }

  getEverBeenUnlocked(userId?: UserId): Promise<boolean> {
    if (userId) {
      return firstValueFrom(this.getEverBeenUnlockedByUserId$(userId));
    }

    return firstValueFrom(this.everBeenUnlocked$);
  }

  async setEverBeenUnlocked(value: boolean, userId?: UserId): Promise<void> {
    if (userId) {
      await this.stateProvider.setUserState(EVER_BEEN_UNLOCKED, value, userId);
      return;
    }

    await this.everBeenUnlockedState.update((_) => value);
  }

  async setVaultTimeoutOptions(timeout: number, action: VaultTimeoutAction): Promise<void> {
    // We swap these tokens from being on disk for lock actions, and in memory for logout actions
    // Get them here to set them to their new location after changing the timeout action and clearing if needed
    const token = await this.tokenService.getToken();
    const refreshToken = await this.tokenService.getRefreshToken();
    const clientId = await this.tokenService.getClientId();
    const clientSecret = await this.tokenService.getClientSecret();

    await this.stateService.setVaultTimeout(timeout);

    const currentAction = await this.stateService.getVaultTimeoutAction();
    if (
      (timeout != null || timeout === 0) &&
      action === VaultTimeoutAction.LogOut &&
      action !== currentAction
    ) {
      // if we have a vault timeout and the action is log out, reset tokens
      await this.tokenService.clearToken();
    }

    await this.stateService.setVaultTimeoutAction(action);

    await this.tokenService.setToken(token);
    await this.tokenService.setRefreshToken(refreshToken);
    await this.tokenService.setClientId(clientId);
    await this.tokenService.setClientSecret(clientSecret);

    await this.cryptoService.refreshAdditionalKeys();
  }

  availableVaultTimeoutActions$(userId?: string) {
    return defer(() => this.getAvailableVaultTimeoutActions(userId));
  }

  async isPinLockSet(userId?: string): Promise<PinLockType> {
    // we can't check the protected pin for both because old accounts only
    // used it for MP on Restart
    const pinIsEnabled = !!(await this.stateService.getProtectedPin({ userId }));
    const aUserKeyPinIsSet = !!(await this.stateService.getPinKeyEncryptedUserKey({ userId }));
    const anOldUserKeyPinIsSet = !!(await this.stateService.getEncryptedPinProtected({ userId }));

    if (aUserKeyPinIsSet || anOldUserKeyPinIsSet) {
      return "PERSISTANT";
    } else if (pinIsEnabled && !aUserKeyPinIsSet && !anOldUserKeyPinIsSet) {
      return "TRANSIENT";
    } else {
      return "DISABLED";
    }
  }

  async isBiometricLockSet(userId?: string): Promise<boolean> {
    return await this.stateService.getBiometricUnlock({ userId });
  }

  async clear(userId?: UserId): Promise<void> {
    await this.setEverBeenUnlocked(false, userId);
    await this.cryptoService.clearPinKeys(userId);
  }

  private async determinePolicyCompliantVaultTimeout(
    currentVaultTimeout: number,
    userId?: string,
  ): Promise<number> {
    if (
      await this.policyService.policyAppliesToUser(PolicyType.MaximumVaultTimeout, null, userId)
    ) {
      const maximumTimeoutPolicy = await this.policyService.getAll(
        PolicyType.MaximumVaultTimeout,
        userId,
      );
      // Remove negative values, and ensure it's smaller than maximum allowed value according to policy
      let policyCompliantTimeout = Math.min(
        currentVaultTimeout,
        maximumTimeoutPolicy[0].data.minutes,
      );

      if (currentVaultTimeout == null || policyCompliantTimeout < 0) {
        policyCompliantTimeout = maximumTimeoutPolicy[0].data.minutes;
      }

      return policyCompliantTimeout;
    }

    // no policy applies so return the current timeout
    return currentVaultTimeout;
  }

  private async determinePolicyCompliantVaultTimeoutAction(
    currentVaultTimeoutAction: VaultTimeoutAction | null,
    userId?: string,
  ): Promise<VaultTimeoutAction> {
    const availableVaultTimeoutActions = await this.getAvailableVaultTimeoutActions();
    if (availableVaultTimeoutActions.length === 1) {
      return availableVaultTimeoutActions[0];
    }

    if (
      await this.policyService.policyAppliesToUser(PolicyType.MaximumVaultTimeout, null, userId)
    ) {
      const maximumTimeoutPolicy = await this.policyService.getAll(
        PolicyType.MaximumVaultTimeout,
        userId,
      );
      const policyDefinedAction = maximumTimeoutPolicy[0].data.action;

      if (policyDefinedAction && availableVaultTimeoutActions.includes(policyDefinedAction)) {
        return policyDefinedAction;
      }
    }

    // No policy applies, use the current timeout action or default based on master password

    if (currentVaultTimeoutAction == null) {
      // Depends on whether or not the user has a master password
      const defaultTimeoutAction = (await this.userHasMasterPassword(userId))
        ? VaultTimeoutAction.Lock
        : VaultTimeoutAction.LogOut;
      return defaultTimeoutAction;
    }

    return currentVaultTimeoutAction === VaultTimeoutAction.LogOut
      ? VaultTimeoutAction.LogOut
      : VaultTimeoutAction.Lock;
  }

  private async getAvailableVaultTimeoutActions(userId?: string): Promise<VaultTimeoutAction[]> {
    const availableActions = [VaultTimeoutAction.LogOut];

    const canLock =
      (await this.userHasMasterPassword(userId)) ||
      (await this.isPinLockSet(userId)) !== "DISABLED" ||
      (await this.isBiometricLockSet(userId));

    if (canLock) {
      availableActions.push(VaultTimeoutAction.Lock);
    }

    return availableActions;
  }

  private async userHasMasterPassword(userId: string): Promise<boolean> {
    const acctDecryptionOpts = await this.stateService.getAccountDecryptionOptions({
      userId: userId,
    });

    if (acctDecryptionOpts?.hasMasterPassword != undefined) {
      return acctDecryptionOpts.hasMasterPassword;
    }
  }
}
