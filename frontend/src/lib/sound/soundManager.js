/**
 * Sound effects — muted by default.
 *
 * Sounds are synthesized in-browser (no MP3 download required).
 * Optional file overrides: add `public/sounds/{eventId}.mp3` and register in SOUND_FILE_URLS.
 */

import { SYNTH_BY_EVENT } from "./soundSynth.js";

const STORAGE_KEY = "playground:sound-enabled";

/** Optional file overrides — only used when the file exists (see tryPlayFile). */
/** @type {Record<string, string>} */
const SOUND_FILE_URLS = {};

/** @type {boolean | null} */
let enabledCache = null;

/** @type {Set<string>} */
const missingFiles = new Set();

/**
 * @returns {boolean}
 */
export function getEnabled() {
  if (enabledCache !== null) return enabledCache;
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    enabledCache = stored === "true";
    return enabledCache;
  } catch {
    enabledCache = false;
    return false;
  }
}

/**
 * @param {boolean} value
 */
export function setEnabled(value) {
  enabledCache = value;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    /* private mode / quota */
  }
}

/**
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function fileExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * @param {string} eventId
 * @param {string} url
 */
async function tryPlayFile(eventId, url) {
  if (missingFiles.has(url)) return false;

  if (!(await fileExists(url))) {
    missingFiles.add(url);
    return false;
  }

  try {
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.addEventListener(
      "error",
      () => {
        missingFiles.add(url);
      },
      { once: true },
    );
    await audio.play();
    return true;
  } catch {
    missingFiles.add(url);
    return false;
  }
}

/**
 * @param {string} eventId
 */
export function play(eventId) {
  if (!getEnabled()) return;
  if (typeof window === "undefined") return;

  if (process.env.NODE_ENV !== "production") {
    console.debug("[sound]", eventId);
  }

  const fileUrl = SOUND_FILE_URLS[eventId];
  if (fileUrl) {
    void tryPlayFile(eventId, fileUrl).then((played) => {
      if (!played) {
        SYNTH_BY_EVENT[eventId]?.();
      }
    });
    return;
  }

  const synth = SYNTH_BY_EVENT[eventId];
  if (synth) {
    try {
      synth();
    } catch {
      /* Web Audio unavailable */
    }
  }
}
