/** @typedef {{ slug: string, title: string, emoji: string, gameId: string, codePattern: 'alpha4' | 'digits4to6' | 'digits6' }} GameSlugMeta */

/** @type {readonly string[]} */
export const GAME_INVITE_SLUGS = [
  'hangman',
  'npat',
  'cah',
  'taboo',
  'typing-race',
];

/** @type {Record<string, GameSlugMeta>} */
export const GAME_SLUG_META = {
  hangman: {
    slug: 'hangman',
    title: 'Hangman',
    emoji: '🪢',
    gameId: 'hangman',
    codePattern: 'alpha4',
  },
  npat: {
    slug: 'npat',
    title: 'Name Place Animal Thing',
    emoji: '🌍',
    gameId: 'name-place-animal-thing',
    codePattern: 'digits4to6',
  },
  cah: {
    slug: 'cah',
    title: 'Cards Against Humanity',
    emoji: '🃏',
    gameId: 'cards-against-humanity',
    codePattern: 'alpha4',
  },
  taboo: {
    slug: 'taboo',
    title: 'Taboo',
    emoji: '🎯',
    gameId: 'taboo',
    codePattern: 'alpha4',
  },
  'typing-race': {
    slug: 'typing-race',
    title: 'Typing Race',
    emoji: '⌨️',
    gameId: 'typing-race',
    codePattern: 'digits6',
  },
};

export const GAME_INVITE_TTL_MS = 30 * 60 * 1000;
export const GAME_INVITE_HISTORY_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * @param {string} slug
 * @returns {GameSlugMeta | null}
 */
export function getGameSlugMeta(slug) {
  return GAME_SLUG_META[String(slug ?? '').trim()] ?? null;
}

/**
 * @param {string} slug
 * @param {string} rawCode
 * @returns {string}
 */
export function normalizeRoomCodeForSlug(slug, rawCode) {
  const meta = getGameSlugMeta(slug);
  const raw = String(rawCode ?? '').trim().toUpperCase();
  if (!meta) return raw.replace(/[^A-Z0-9]/g, '');
  switch (meta.codePattern) {
    case 'alpha4':
      return raw.replace(/[^A-Z0-9]/g, '').slice(0, 4);
    case 'digits4to6':
      return raw.replace(/\D/g, '').slice(0, 6);
    case 'digits6':
      return raw.replace(/\D/g, '').slice(0, 6);
    default:
      return raw.replace(/[^A-Z0-9]/g, '');
  }
}

/**
 * @param {string} slug
 * @param {string} code
 * @returns {boolean}
 */
export function isValidRoomCodeForSlug(slug, code) {
  const meta = getGameSlugMeta(slug);
  if (!meta || !code) return false;
  switch (meta.codePattern) {
    case 'alpha4':
      return /^[A-Z0-9]{4}$/.test(code);
    case 'digits4to6':
      return /^\d{4,6}$/.test(code);
    case 'digits6':
      return /^\d{6}$/.test(code);
    default:
      return code.length > 0;
  }
}

/**
 * @param {string} slug
 * @param {string} code
 * @returns {string}
 */
export function buildJoinPathForSlug(slug, code) {
  const normalized = normalizeRoomCodeForSlug(slug, code);
  if (slug === 'npat') {
    return `/games/npat/lobby?code=${encodeURIComponent(normalized)}`;
  }
  return `/games/${slug}/join?code=${encodeURIComponent(normalized)}`;
}
