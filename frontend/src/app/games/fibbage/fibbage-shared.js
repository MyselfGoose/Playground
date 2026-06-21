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
