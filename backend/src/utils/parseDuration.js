import { AppError } from '../errors/AppError.js';

/**
 * Parse compact durations like `15m`, `7d`, `1h`, `30s` into milliseconds.
 * @param {string} input
 */
export function parseDurationToMs(input) {
  const m = String(input).trim().match(/^(\d+)([smhd])$/i);
  if (!m) {
    throw new AppError(500, 'Invalid JWT expiry configuration', { code: 'CONFIG_ERROR', expose: false });
  }
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * mult[u];
}
