/**
 * Split passage into word-like groups for layout (whitespace as own parts).
 * @param {string} passage
 * @returns {{ text: string; globalStart: number }[]}
 */
export function splitPassageWords(passage) {
  /** @type {{ text: string; globalStart: number }[]} */
  const parts = [];
  const re = /\S+|\s+/g;
  let m;
  while ((m = re.exec(passage)) !== null) {
    parts.push({ text: m[0], globalStart: m.index });
  }
  return parts;
}

/**
 * Which word part index contains this character index (non-whitespace parts only).
 * @param {{ text: string; globalStart: number }[]} parts
 * @param {number} charIndex
 */
export function findActiveWordPartIndex(parts, charIndex) {
  for (let w = 0; w < parts.length; w++) {
    const { text, globalStart } = parts[w];
    const end = globalStart + text.length;
    if (charIndex >= globalStart && charIndex < end && /\S/.test(text)) {
      return w;
    }
  }
  return -1;
}
