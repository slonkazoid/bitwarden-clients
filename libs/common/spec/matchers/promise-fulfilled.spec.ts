describe("toBeFulfilled", () => {
  it("passes when promise is resolved", async () => {
    const promise = Promise.resolve("resolved");
    await promise;
    await expect(promise).toBeFulfilled();
  });

  it("passes when promise is rejected", async () => {
    const promise = Promise.reject("rejected");
    await promise.catch(() => {});
    await expect(promise).toBeFulfilled();
  });

  it("fails when promise is pending", async () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 1000));
    await expect(promise).not.toBeFulfilled();
  });
});

describe("toBeResolved", () => {
  it("passes when promise is resolved", async () => {
    const promise = Promise.resolve("resolved");
    await promise;
    await expect(promise).toBeResolved();
  });

  it("fails when promise is rejected", async () => {
    const promise = Promise.reject("rejected");
    await promise.catch(() => {});
    await expect(promise).not.toBeResolved();
  });

  it("fails when promise is pending", async () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 1000));
    await expect(promise).not.toBeResolved();
  });
});

describe("toBeRejected", () => {
  it("fails when promise is resolved", async () => {
    const promise = Promise.resolve("resolved");
    await promise;
    await expect(promise).not.toBeRejected();
  });

  it("passes when promise is rejected", async () => {
    const promise = Promise.reject("rejected");
    await promise.catch(() => {});
    await expect(promise).toBeRejected();
  });

  it("fails when promise is pending", async () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 1000));
    await expect(promise).not.toBeRejected();
  });
});
