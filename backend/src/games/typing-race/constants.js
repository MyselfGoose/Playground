export const TYPING_RACE_ROOM_CODE_LEN = 6;
export const TYPING_RACE_MAX_PLAYERS = 8;
export const TYPING_RACE_MIN_PLAYERS = 2;
export const TYPING_RACE_COUNTDOWN_MS = 5000;
/** Wall clock cap so abandoned rooms eventually end */
export const TYPING_RACE_MAX_WALL_MS = 10 * 60 * 1000;
export const TYPING_RACE_DISCONNECT_GRACE_MS = 60_000;

/** @type {readonly string[]} */
export const PLAYER_COLORS = [
  "#7c6cf0",
  "#5bbfb3",
  "#ff8a7a",
  "#c5e8ff",
  "#e8deff",
  "#d4f5e9",
  "#ffe4d6",
  "#fff3bf",
];
