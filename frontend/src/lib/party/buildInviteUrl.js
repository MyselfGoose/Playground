/**
 * Invite deep-link builder for multiplayer games (F-02).
 *
 * URL path segment (`gameSlug`) under `/games/` — not catalog `gameId`:
 *
 * | gameSlug      | Game        | Join handler        |
 * |---------------|-------------|---------------------|
 * | hangman       | Hangman     | Phase 06            |
 * | npat          | NPAT        | Phase 11+           |
 * | taboo         | Taboo       | Phase 12+           |
 * | cah           | CAH         | Phase 13+           |
 * | typing-race   | Typing Race | Phase 11+           |
 *
 * Future games: add a join route at `/games/{gameSlug}/join` and read `?code=` on entry.
 */

/**
 * @param {string} raw
 */
function normalizePartyCode(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * @param {string} gameSlug Path segment (e.g. `hangman`, `npat`)
 * @param {string} code Room code from the server
 * @param {string} [origin] Base origin; defaults to `window.location.origin` in browser
 * @returns {string}
 */
export function buildInviteUrl(gameSlug, code, origin) {
  const slug = String(gameSlug ?? "").trim().replace(/^\/+|\/+$/g, "");
  const normalized = normalizePartyCode(code);
  const base =
    origin !== undefined
      ? String(origin).replace(/\/+$/, "")
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  if (!slug || !normalized) return base ? `${base}/games` : "/games";
  const params = new URLSearchParams({ code: normalized });
  return `${base}/games/${slug}/join?${params.toString()}`;
}

export { normalizePartyCode };
