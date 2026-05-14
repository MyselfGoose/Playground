import { describe, it, expect, vi } from "vitest";
import { withRefreshStorageLock } from "./refreshStorageMutex.js";

describe("withRefreshStorageLock", () => {
  it("runs request when localStorage.getItem throws", async () => {
    const store = {
      getItem() {
        throw new DOMException("denied", "SecurityError");
      },
      setItem() {},
      removeItem() {},
    };
    vi.stubGlobal("localStorage", store);
    const ran = vi.fn().mockResolvedValue("ok");
    await expect(withRefreshStorageLock(ran)).resolves.toBe("ok");
    expect(ran).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("runs request and releases lock when localStorage works", async () => {
    const mem = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => {
        mem.set(k, v);
      },
      removeItem: (k) => {
        mem.delete(k);
      },
    });
    const ran = vi.fn().mockResolvedValue(42);
    await expect(withRefreshStorageLock(ran)).resolves.toBe(42);
    expect(ran).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
