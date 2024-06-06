async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Matches whether the received promise has been fulfilled.
 *
 * Failure if the promise is not currently fulfilled.
 */
export const toBeFulfilled: jest.CustomMatcher = async function (received: Promise<unknown>) {
  return {
    pass: await Promise.race([
      wait(0).then(() => false),
      received.then(
        () => true,
        () => true,
      ),
    ]),
    message: () => `expected promise to be resolved`,
  };
};

/**
 * Matches whether the received promise has been resolved.
 *
 * Failure if the promise is not currently fulfilled or if it has been rejected.
 */
export const toBeResolved: jest.CustomMatcher = async function (received: Promise<unknown>) {
  return {
    pass: await Promise.race([
      wait(0).then(() => false),
      received.then(
        () => true,
        () => false,
      ),
    ]),
    message: () => `expected promise to be resolved`,
  };
};

/**
 * Matches whether the received promise has been rejected.
 *
 * Failure if the promise is not currently fulfilled or if it has been resolved, but not rejected.
 */
export const toBeRejected: jest.CustomMatcher = async function (received: Promise<unknown>) {
  return {
    pass: await Promise.race([
      wait(0).then(() => false),
      received.then(
        () => false,
        () => true,
      ),
    ]),
    message: () => `expected promise to be resolved`,
  };
};
