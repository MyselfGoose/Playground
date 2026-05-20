/**
 * Lightweight synthesized UI sounds (no asset files required).
 * Uses Web Audio API — works offline and avoids missing-file errors.
 */

/** @type {AudioContext | null} */
let sharedContext = null;

/**
 * @returns {AudioContext | null}
 */
function getContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedContext) {
    sharedContext = new Ctx();
  }
  return sharedContext;
}

/**
 * @param {AudioContext} ctx
 * @param {number} frequencyHz
 * @param {number} startAt
 * @param {number} durationSec
 * @param {number} peakGain
 */
function playTone(ctx, frequencyHz, startAt, durationSec, peakGain) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequencyHz;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec + 0.05);
}

/** Bright three-note chime for wins, GO, and correct feedback. */
export function playSuccessChime() {
  const ctx = getContext();
  if (!ctx) return;

  void ctx.resume().catch(() => {
    /* needs user gesture on some browsers */
  });

  const t0 = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99];
  const spacing = 0.09;
  const noteLen = 0.22;

  for (let i = 0; i < notes.length; i += 1) {
    playTone(ctx, notes[i], t0 + i * spacing, noteLen, 0.12);
  }
}

/** @type {Record<string, () => void>} */
export const SYNTH_BY_EVENT = {
  success: playSuccessChime,
};
