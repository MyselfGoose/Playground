import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** @type {Record<string, string>} */
const store = {};

const localStorageMock = {
  getItem: (key) => (key in store ? store[key] : null),
  setItem: (key, value) => {
    store[key] = String(value);
  },
  removeItem: (key) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) delete store[key];
  },
};

describe("soundManager", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorageMock.clear();
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorageMock.clear();
  });

  it("defaults getEnabled to false", async () => {
    const { getEnabled } = await import("./soundManager.js");
    expect(getEnabled()).toBe(false);
  });

  it("persists setEnabled in localStorage", async () => {
    const { getEnabled, setEnabled } = await import("./soundManager.js");
    setEnabled(true);
    expect(getEnabled()).toBe(true);
    expect(localStorageMock.getItem("playground:sound-enabled")).toBe("true");
    setEnabled(false);
    expect(getEnabled()).toBe(false);
    expect(localStorageMock.getItem("playground:sound-enabled")).toBe("false");
  });

  it("play does not throw when disabled", async () => {
    const { play, setEnabled } = await import("./soundManager.js");
    setEnabled(false);
    expect(() => play("success")).not.toThrow();
  });

  it("play uses synth without HTML Audio when enabled", async () => {
    const audioCtor = vi.fn();
    vi.stubGlobal("Audio", audioCtor);

    const { play, setEnabled } = await import("./soundManager.js");
    setEnabled(true);
    expect(() => play("success")).not.toThrow();
    expect(audioCtor).not.toHaveBeenCalled();
  });
});
