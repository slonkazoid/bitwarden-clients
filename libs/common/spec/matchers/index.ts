import { toBeFulfilled, toBeResolved, toBeRejected } from "./promise-fulfilled";
import { toAlmostEqual } from "./to-almost-equal";
import { toEqualBuffer } from "./to-equal-buffer";

export * from "./to-equal-buffer";
export * from "./to-almost-equal";
export * from "./promise-fulfilled";

export function addCustomMatchers() {
  expect.extend({
    toEqualBuffer: toEqualBuffer,
    toAlmostEqual: toAlmostEqual,
    toBeFulfilled: toBeFulfilled,
    toBeResolved: toBeResolved,
    toBeRejected: toBeRejected,
  });
}

export interface CustomMatchers<R = unknown> {
  toEqualBuffer(expected: Uint8Array | ArrayBuffer): R;
  /**
   * Matches the expected date within an optional ms precision
   * @param expected The expected date
   * @param msPrecision The optional precision in milliseconds
   */
  toAlmostEqual(expected: Date, msPrecision?: number): R;
  toBeFulfilled(): Promise<R>;
  toBeResolved(): Promise<R>;
  toBeRejected(): Promise<R>;
}
