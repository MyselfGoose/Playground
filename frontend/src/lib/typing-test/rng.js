/** @typedef {() => number} Rng */

/** Mulberry32 — deterministic PRNG for seeded games and server replay */
export function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} seed
 * @param {number} min
 * @param {number} max inclusive
 */
export function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
