import { Observable, map } from "rxjs";

import { GlobalStateProvider, KeyDefinition, ANIMATION_DISK } from "../state";

export abstract class AnimationControlService {
  /**
   * The routing animation toggle.
   */
  abstract routingAnimation$: Observable<boolean>;

  /**
   * A method for updating the state of the animation toggle.
   * @param theme The new state.
   */
  abstract setRoutingAnimation(state: boolean): Promise<void>;
}

const ROUTING_ANIMATION = new KeyDefinition<boolean>(ANIMATION_DISK, "routing", {
  deserializer: (s) => s,
});

export class DefaultAnimationControlService implements AnimationControlService {
  private readonly routingAnimationState = this.globalStateProvider.get(ROUTING_ANIMATION);

  routingAnimation$ = this.routingAnimationState.state$.pipe(
    map((state) => state ?? this.defaultRoutingAnimation),
  );

  constructor(
    private globalStateProvider: GlobalStateProvider,
    private defaultRoutingAnimation: boolean = true,
  ) {}

  async setRoutingAnimation(state: boolean): Promise<void> {
    await this.routingAnimationState.update(() => state, {
      shouldUpdate: (currentState) => currentState !== state,
    });
  }
}
