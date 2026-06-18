import sharp from 'sharp';
import { detectImageMimeFromBuffer } from './feedbackScreenshot.js';

const OUTPUT_SIZE = 256;
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 4096;

/**
 * @param {Buffer} input
 * @param {number} maxBytes
 */
export async function processAvatarImage(input, maxBytes) {
  const detected = detectImageMimeFromBuffer(input);
  if (!detected) {
    return { ok: false, message: 'unsupported image type (use PNG, JPEG, or WebP)' };
  }
  if (input.length > maxBytes) {
    return { ok: false, message: `image too large (max ${Math.round(maxBytes / 1024)} KB)` };
  }

  let meta;
  try {
    meta = await sharp(input).metadata();
  } catch {
    return { ok: false, message: 'could not read image' };
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return { ok: false, message: `image too small (minimum ${MIN_DIMENSION}×${MIN_DIMENSION}px)` };
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return { ok: false, message: `image too large (maximum ${MAX_DIMENSION}×${MAX_DIMENSION}px)` };
  }

  try {
    const buffer = await sharp(input)
      .rotate()
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 85 })
      .toBuffer();
    return { ok: true, buffer, mime: 'image/webp' };
  } catch {
    return { ok: false, message: 'could not process image' };
  }
}

/**
 * @param {string} raw
 */
export function validateAvatarEmoji(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return { ok: false, message: 'emoji is required' };
  }
  if (trimmed.length > 32) {
    return { ok: false, message: 'emoji is too long' };
  }

  let segments;
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    segments = [...segmenter.segment(trimmed)].map((s) => s.segment);
  } else {
    segments = [...trimmed];
  }

  if (segments.length !== 1) {
    return { ok: false, message: 'choose exactly one emoji' };
  }

  const emoji = segments[0];
  if (!/\p{Extended_Pictographic}/u.test(emoji)) {
    return { ok: false, message: 'choose a valid emoji' };
  }

  return { ok: true, emoji };
}
