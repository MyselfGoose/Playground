/** @typedef {{ slug: string, title: string, emoji: string, gameId: string }} GameSlugMeta */

/** @type {Record<string, GameSlugMeta>} */
export const GAME_SLUG_META = {
  hangman: { slug: "hangman", title: "Hangman", emoji: "🪢", gameId: "hangman" },
  npat: { slug: "npat", title: "Name Place Animal Thing", emoji: "🌍", gameId: "name-place-animal-thing" },
  cah: { slug: "cah", title: "Cards Against Humanity", emoji: "🃏", gameId: "cards-against-humanity" },
  taboo: { slug: "taboo", title: "Taboo", emoji: "🎯", gameId: "taboo" },
  "typing-race": { slug: "typing-race", title: "Typing Race", emoji: "⌨️", gameId: "typing-race" },
  fibbage: { slug: "fibbage", title: "Fibbage", emoji: "🎭", gameId: "fibbage" },
};

/**
 * @param {string} slug
 * @returns {GameSlugMeta | undefined}
 */
export function getGameSlugMeta(slug) {
  return GAME_SLUG_META[String(slug ?? "").trim()];
}

/**
 * @param {string} slug
 * @param {string} code
 * @returns {string}
 */
export function buildInviteJoinPath(slug, code) {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (slug === "typing-race") {
    const digits = normalized.replace(/\D/g, "").slice(0, 6);
    return `/games/typing-race/join?code=${encodeURIComponent(digits)}`;
  }
  if (slug === "npat" || slug === "hangman" || slug === "cah" || slug === "taboo" || slug === "fibbage") {
    return `/games/${slug}/lobby?code=${encodeURIComponent(normalized)}`;
  }
  return `/games/${slug}/join?code=${encodeURIComponent(normalized)}`;
}
