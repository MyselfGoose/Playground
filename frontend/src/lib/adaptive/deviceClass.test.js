/**
 * @typedef {import('../lib/adaptive/deviceClass.js').DeviceClass} DeviceClass
 */

import { describe, expect, it } from "vitest";
import {
  isGameImmersiveRoute,
  isPhoneDevice,
  resolveDeviceClass,
  resolveLobbyWidthProfile,
  resolveNavProfile,
  resolveOrientation,
} from "./deviceClass.js";

describe("isPhoneDevice", () => {
  it("detects phone device classes", () => {
    expect(isPhoneDevice(resolveDeviceClass(320, 568))).toBe(true);
    expect(isPhoneDevice(resolveDeviceClass(390, 844))).toBe(true);
    expect(isPhoneDevice(resolveDeviceClass(430, 932))).toBe(true);
    expect(isPhoneDevice(resolveDeviceClass(768, 1024))).toBe(false);
  });
});

describe("resolveDeviceClass", () => {
  it("classifies small phones", () => {
    expect(resolveDeviceClass(320, 568)).toBe("smallPhone");
  });

  it("classifies standard phones", () => {
    expect(resolveDeviceClass(390, 844)).toBe("standardPhone");
  });

  it("classifies tablets", () => {
    expect(resolveDeviceClass(768, 1024)).toBe("tablet");
  });

  it("classifies ultrawide", () => {
    expect(resolveDeviceClass(2560, 1080)).toBe("ultrawide");
  });
});

describe("resolveOrientation", () => {
  it("detects portrait and landscape", () => {
    expect(resolveOrientation(390, 844)).toBe("portrait");
    expect(resolveOrientation(844, 390)).toBe("landscape");
  });
});

describe("resolveNavProfile", () => {
  it("uses immersive nav on play routes", () => {
    expect(resolveNavProfile("standardPhone", true)).toBe("nav-game-immersive");
    expect(resolveNavProfile("standardLaptop", true)).toBe("nav-game-immersive");
  });

  it("uses compact nav on small phones", () => {
    expect(resolveNavProfile("smallPhone", false)).toBe("nav-compact");
  });
});

describe("resolveLobbyWidthProfile", () => {
  it("widens lobby on tablet landscape", () => {
    expect(resolveLobbyWidthProfile("tablet", "landscape")).toBe("wide");
    expect(resolveLobbyWidthProfile("standardPhone", "portrait")).toBe("narrow");
  });
});

describe("isGameImmersiveRoute", () => {
  it("matches play and lobby routes", () => {
    expect(isGameImmersiveRoute("/games/taboo/play")).toBe(true);
    expect(isGameImmersiveRoute("/games/cah/lobby")).toBe(true);
    expect(isGameImmersiveRoute("/games/typing-race/multi/room/ABC")).toBe(true);
    expect(isGameImmersiveRoute("/games")).toBe(false);
    expect(isGameImmersiveRoute("/games/taboo")).toBe(false);
  });
});
