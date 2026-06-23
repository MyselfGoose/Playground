"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  isGameImmersiveRoute,
  isPhoneDevice,
  resolveDeviceClass,
  resolveLayoutProfile,
  resolveLobbyWidthProfile,
  resolveNavProfile,
  resolveOrientation,
} from "./deviceClass.js";

/** @typedef {import('./deviceClass.js').DeviceClass} DeviceClass */
/** @typedef {import('./deviceClass.js').Orientation} Orientation */
/** @typedef {import('./deviceClass.js').LayoutProfile} LayoutProfile */
/** @typedef {import('./deviceClass.js').NavProfile} NavProfile */
/** @typedef {import('./deviceClass.js').LobbyWidthProfile} LobbyWidthProfile */

/**
 * @typedef {Object} AdaptiveLayoutState
 * @property {DeviceClass} deviceClass
 * @property {Orientation} orientation
 * @property {boolean} isPortrait
 * @property {boolean} isLandscape
 * @property {boolean} isTouch
 * @property {boolean} isLandscapeShort
 * @property {boolean} isUltrawide
 * @property {boolean} isTabletOrAbove
 * @property {LayoutProfile} layoutProfile
 * @property {NavProfile} navProfile
 * @property {LobbyWidthProfile} lobbyWidthProfile
 * @property {boolean} isGameImmersive
 * @property {number} width
 * @property {number} height
 * @property {boolean} isPhone
 * @property {boolean} isKeyboardOpen
 */

const DEFAULT_WIDTH = 390;
const DEFAULT_HEIGHT = 844;

/**
 * @returns {AdaptiveLayoutState}
 */
function buildState(width, height, isTouch, isKeyboardOpen, pathname) {
  const deviceClass = resolveDeviceClass(width, height);
  const orientation = resolveOrientation(width, height);
  const isGameImmersive = isGameImmersiveRoute(pathname);
  const isLandscapeShort = orientation === "landscape" && height <= 500;
  const isTabletOrAbove =
    deviceClass === "tablet" ||
    deviceClass === "foldableExpanded" ||
    deviceClass === "smallLaptop" ||
    deviceClass === "standardLaptop" ||
    deviceClass === "ultrawide";

  return {
    deviceClass,
    orientation,
    isPortrait: orientation === "portrait",
    isLandscape: orientation === "landscape",
    isTouch,
    isPhone: isPhoneDevice(deviceClass),
    isLandscapeShort,
    isUltrawide: deviceClass === "ultrawide",
    isTabletOrAbove,
    layoutProfile: resolveLayoutProfile(deviceClass, orientation, isTouch),
    navProfile: resolveNavProfile(deviceClass, isGameImmersive),
    lobbyWidthProfile: resolveLobbyWidthProfile(deviceClass, orientation),
    isGameImmersive,
    width,
    height,
    isKeyboardOpen,
  };
}

/**
 * @returns {AdaptiveLayoutState}
 */
function getInitialState(pathname) {
  // Keep SSR and the first client render identical; resize listeners update after mount.
  return buildState(DEFAULT_WIDTH, DEFAULT_HEIGHT, true, false, pathname);
}

/**
 * Unified adaptive layout hook — single source for device class, orientation, and layout profiles.
 * @returns {AdaptiveLayoutState}
 */
export function useAdaptiveLayout() {
  const pathname = usePathname() ?? "/";
  const [state, setState] = useState(() => getInitialState(pathname));

  const update = useCallback(() => {
    const isTouch =
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches;
    const keyboardOffset = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--keyboard-offset"),
    );
    setState(
      buildState(
        window.innerWidth,
        window.innerHeight,
        isTouch,
        keyboardOffset > 0,
        pathname,
      ),
    );
  }, [pathname]);

  useEffect(() => {
    update();

    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("orientationchange", update, { passive: true });

    const coarseMq = window.matchMedia("(pointer: coarse)");
    const hoverMq = window.matchMedia("(hover: none)");
    coarseMq.addEventListener("change", update);
    hoverMq.addEventListener("change", update);

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      coarseMq.removeEventListener("change", update);
      hoverMq.removeEventListener("change", update);
      observer.disconnect();
    };
  }, [update]);

  return state;
}

/**
 * @param {AdaptiveLayoutState} layout
 * @returns {boolean}
 */
export function shouldConfirmTouchAction(layout) {
  return layout.isTouch && isCompactDeviceClass(layout.deviceClass);
}

/**
 * @param {DeviceClass} deviceClass
 * @returns {boolean}
 */
export function isCompactDeviceClass(deviceClass) {
  return (
    deviceClass === "smallPhone" ||
    deviceClass === "standardPhone" ||
    deviceClass === "foldableNarrow"
  );
}
