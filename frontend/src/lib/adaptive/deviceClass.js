/**
 * @typedef {'smallPhone' | 'standardPhone' | 'largePhone' | 'foldableNarrow' | 'foldableExpanded' | 'tablet' | 'smallLaptop' | 'standardLaptop' | 'ultrawide'} DeviceClass
 */

/**
 * @typedef {'portrait' | 'landscape'} Orientation
 */

/**
 * @typedef {'compact' | 'stacked' | 'split' | 'rail-right' | 'rail-bottom' | 'immersive'} LayoutProfile
 */

/**
 * @typedef {'nav-compact' | 'nav-standard' | 'nav-tablet' | 'nav-desktop' | 'nav-game-immersive'} NavProfile
 */

/**
 * @typedef {'narrow' | 'medium' | 'wide'} LobbyWidthProfile
 */

/**
 * @param {number} width
 * @param {number} height
 * @returns {DeviceClass}
 */
export function resolveDeviceClass(width, height) {
  const aspect = width / Math.max(height, 1);

  if (width >= 1920 || aspect >= 2.1) {
    return "ultrawide";
  }
  if (width >= 1280) {
    return height < 720 ? "smallLaptop" : "standardLaptop";
  }
  if (width >= 1024) {
    return "smallLaptop";
  }
  if (width >= 768) {
    return "tablet";
  }
  if (width >= 600 && width < 768 && height >= 600) {
    return "foldableExpanded";
  }
  if (width >= 431) {
    return "largePhone";
  }
  if (width >= 280 && width < 360 && height >= 700) {
    return "foldableNarrow";
  }
  if (width >= 361) {
    return "standardPhone";
  }
  return "smallPhone";
}

/**
 * @param {number} width
 * @param {number} height
 * @returns {Orientation}
 */
export function resolveOrientation(width, height) {
  return width >= height ? "landscape" : "portrait";
}

/**
 * @param {DeviceClass} deviceClass
 * @param {Orientation} orientation
 * @param {boolean} isTouch
 * @returns {LayoutProfile}
 */
export function resolveLayoutProfile(deviceClass, orientation, isTouch) {
  const isPhone =
    deviceClass === "smallPhone" ||
    deviceClass === "standardPhone" ||
    deviceClass === "largePhone" ||
    deviceClass === "foldableNarrow";

  if (isPhone && orientation === "landscape") {
    return "split";
  }
  if (isPhone) {
    return "stacked";
  }
  if (deviceClass === "tablet" || deviceClass === "foldableExpanded") {
    return "split";
  }
  if (deviceClass === "ultrawide" || deviceClass === "standardLaptop") {
    return "rail-right";
  }
  if (deviceClass === "smallLaptop") {
    return orientation === "landscape" ? "rail-right" : "stacked";
  }
  return isTouch ? "stacked" : "rail-right";
}

/**
 * @param {DeviceClass} deviceClass
 * @param {boolean} isGameImmersive
 * @returns {NavProfile}
 */
export function resolveNavProfile(deviceClass, isGameImmersive) {
  if (isGameImmersive) {
    return "nav-game-immersive";
  }
  if (
    deviceClass === "smallPhone" ||
    deviceClass === "standardPhone" ||
    deviceClass === "foldableNarrow"
  ) {
    return "nav-compact";
  }
  if (deviceClass === "largePhone" || deviceClass === "foldableExpanded") {
    return "nav-standard";
  }
  if (deviceClass === "tablet") {
    return "nav-tablet";
  }
  return "nav-desktop";
}

/**
 * @param {DeviceClass} deviceClass
 * @param {Orientation} orientation
 * @returns {LobbyWidthProfile}
 */
export function resolveLobbyWidthProfile(deviceClass, orientation) {
  if (
    deviceClass === "tablet" ||
    deviceClass === "foldableExpanded" ||
    deviceClass === "smallLaptop" ||
    deviceClass === "standardLaptop" ||
    deviceClass === "ultrawide"
  ) {
    return orientation === "landscape" ? "wide" : "medium";
  }
  if (deviceClass === "largePhone") {
    return "medium";
  }
  return "narrow";
}

/**
 * @param {DeviceClass} deviceClass
 * @returns {boolean}
 */
export function isPhoneDevice(deviceClass) {
  return (
    deviceClass === "smallPhone" ||
    deviceClass === "standardPhone" ||
    deviceClass === "largePhone" ||
    deviceClass === "foldableNarrow"
  );
}

/**
 * @param {DeviceClass} deviceClass
 * @returns {boolean}
 */
export function isCompactDevice(deviceClass) {
  return (
    deviceClass === "smallPhone" ||
    deviceClass === "standardPhone" ||
    deviceClass === "foldableNarrow"
  );
}

/**
 * @param {DeviceClass} deviceClass
 * @returns {boolean}
 */
export function isTabletOrAbove(deviceClass) {
  return (
    deviceClass === "tablet" ||
    deviceClass === "foldableExpanded" ||
    deviceClass === "smallLaptop" ||
    deviceClass === "standardLaptop" ||
    deviceClass === "ultrawide"
  );
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isGameImmersiveRoute(pathname) {
  if (!pathname.startsWith("/games/")) {
    return false;
  }
  return (
    pathname.includes("/play") ||
    pathname.includes("/lobby") ||
    pathname.includes("/multi/room/")
  );
}
