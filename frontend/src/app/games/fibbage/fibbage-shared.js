/** Keep in sync with backend/src/games/fibbage/constants.js */
export const FIBBAGE_LIE_MIN_LENGTH = 1;
export const FIBBAGE_LIE_MAX_LENGTH = 120;

export const FIBBAGE_PATHS = {
  entry: "/games/fibbage",
  lobby: "/games/fibbage/lobby",
  play: "/games/fibbage/play",
  result: "/games/fibbage/result",
  join: "/games/fibbage/join",
};

/** @param {string} subpath */
export function fibbagePath(subpath) {
  return `/games/fibbage${subpath ? `/${subpath}` : ""}`;
}
