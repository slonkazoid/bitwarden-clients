import { objToStore } from "./abstractions/abstract-chrome-storage-api.service";
import BrowserLocalStorageService, {
  RESEED_IN_PROGRESS_KEY,
} from "./browser-local-storage.service";

const apiGetLike =
  (store: Record<any, any>) => (key: string, callback: (items: { [key: string]: any }) => void) => {
    if (key == null) {
      callback(store);
    } else {
      callback({ [key]: store[key] });
    }
  };

describe("BrowserLocalStorageService", () => {
  let service: BrowserLocalStorageService;
  let store: Record<any, any>;
  let changeListener: (changes: { [key: string]: chrome.storage.StorageChange }) => void;

  let saveMock: jest.Mock;
  let getMock: jest.Mock;
  let clearMock: jest.Mock;
  let removeMock: jest.Mock;

  beforeEach(() => {
    store = {};

    // Record change listener
    chrome.storage.local.onChanged.addListener = jest.fn((listener) => {
      changeListener = listener;
    });

    service = new BrowserLocalStorageService();

    // setup mocks
    getMock = chrome.storage.local.get as jest.Mock;
    getMock.mockImplementation(apiGetLike(store));
    saveMock = chrome.storage.local.set as jest.Mock;
    saveMock.mockImplementation((update, callback) => {
      Object.entries(update).forEach(([key, value]) => {
        store[key] = value;
      });
      callback();
    });
    clearMock = chrome.storage.local.clear as jest.Mock;
    clearMock.mockImplementation((callback) => {
      store = {};
      callback?.();
    });
    removeMock = chrome.storage.local.remove as jest.Mock;
    removeMock.mockImplementation((keys, callback) => {
      if (Array.isArray(keys)) {
        keys.forEach((key) => {
          delete store[key];
        });
      } else {
        delete store[keys];
      }

      callback();
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("reseed", () => {
    it.each([
      {
        key1: objToStore("value1"),
        key2: objToStore("value2"),
        key3: null,
      },
      {},
    ])("reseeds data %s", async (testStore) => {
      for (const key of Object.keys(testStore) as Array<keyof typeof testStore>) {
        store[key] = testStore[key];
      }
      await service.reseed();

      expect(clearMock).toHaveBeenCalledTimes(1);
      expect(saveMock).toHaveBeenLastCalledWith(
        { ...testStore, [RESEED_IN_PROGRESS_KEY]: objToStore(true) },
        expect.any(Function),
      );
    });

    it("converts non-serialized values to serialized", async () => {
      store.key1 = "value1";
      store.key2 = "value2";

      const expectedStore = Object.entries(store).reduce(
        (agg, [key, value]) => {
          agg[key] = objToStore(value);
          return agg;
        },
        {} as Record<string, unknown>,
      );
      expectedStore.reseedInProgress = objToStore(true);

      await service.reseed();

      expect(saveMock).toHaveBeenLastCalledWith(expectedStore, expect.any(Function));
    });

    it("clears data", async () => {
      await service.reseed();

      expect(clearMock).toHaveBeenCalledTimes(1);
    });

    it("indicates a reseed is in progress", async () => {
      await service.reseed();

      expect(saveMock).toHaveBeenNthCalledWith(
        1,
        { reseedInProgress: objToStore(true) },
        expect.any(Function),
      );
    });

    it("removes the reseed in progress key", async () => {
      await service.reseed();

      expect(removeMock).toHaveBeenCalledTimes(1);
      expect(removeMock).toHaveBeenCalledWith("reseedInProgress", expect.any(Function));
    });
  });

  describe.each(["get", "has", "save", "remove"] as const)("%s", (method) => {
    let interval: string | number | NodeJS.Timeout;

    afterEach(() => {
      if (interval) {
        clearInterval(interval);
      }
    });

    function startReseed() {
      store[RESEED_IN_PROGRESS_KEY] = objToStore(true);
    }

    function endReseed() {
      delete store[RESEED_IN_PROGRESS_KEY];
      changeListener({ reseedInProgress: { oldValue: true } });
    }

    it("waits for reseed prior to operation", async () => {
      startReseed();

      const promise = service[method]("key", "value"); // note "value" is only used in save, but ignored in other methods

      await expect(promise).not.toBeFulfilled();

      endReseed();

      await promise;

      await expect(promise).toBeResolved();
    });

    it("does not wait if reseed is not in progress", async () => {
      const promise = service[method]("key", "value");
      await promise;
      await expect(promise).toBeResolved();
    });
  });
});
