/** MIME types accepted after client-side crop (output is always WebP or JPEG). */
export const CROPPED_OUTPUT_MIMES = ["image/webp", "image/jpeg"];

/** Input types we attempt to load in the browser cropper. */
export const ACCEPTED_INPUT_MIMES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];

/** Pre-crop limit — large phone photos are downscaled in the cropper before upload. */
export const MAX_AVATAR_SOURCE_BYTES = 12 * 1024 * 1024;

const EXTENSION_PATTERN = /\.(jpe?g|png|webp|heic|heif)$/i;

/**
 * Mobile browsers (especially iOS Safari) often omit MIME type or send HEIC.
 * @param {File} file
 */
export function isAcceptedAvatarSourceFile(file) {
  const type = (file.type || "").toLowerCase().trim();
  if (ACCEPTED_INPUT_MIMES.includes(type)) return true;
  if (type.startsWith("image/")) return true;
  if (!type && EXTENSION_PATTERN.test(file.name)) return true;
  return false;
}

/**
 * @param {File} file
 * @returns {string | null}
 */
export function avatarSourceRejectionMessage(file) {
  if (!isAcceptedAvatarSourceFile(file)) {
    return "Use a photo in PNG, JPEG, WebP, or HEIC format.";
  }
  if (file.size > MAX_AVATAR_SOURCE_BYTES) {
    return "Image must be 12 MB or smaller.";
  }
  return null;
}
