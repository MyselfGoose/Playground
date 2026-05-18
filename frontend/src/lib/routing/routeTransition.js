/** Marketing routes get enter fade; game play surfaces mount instantly. */

const MARKETING_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/games",
  "/leaderboard",
  "/profile",
]);

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function shouldAnimateRouteTransition(pathname) {
  if (MARKETING_ROUTES.has(pathname)) return true;
  if (pathname.startsWith("/profile/")) return true;

  if (/\/(play|lobby|multi)(\/|$)/.test(pathname)) return false;
  if (pathname.startsWith("/games/typing-race/multi/room/")) return false;

  return false;
}
