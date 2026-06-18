import { ACCESS_TOKEN_COOKIE } from '../constants/auth.js';
import { parseCookies } from '../utils/parseCookies.js';
import { resolveSocketCredential } from './authMiddleware.js';
import { bumpMetric } from '../observability/platformMetrics.js';
import { userRepository } from '../repositories/userRepository.js';
import { avatarFromUser } from '../utils/lobbyPlayerAvatar.js';

/**
 * Collect handshake JWT candidates. **Cookie first** so browser cookie rotation from `/auth/refresh`
 * wins over a pinned `auth.token` (SSOT / typing-race stale JWT fix).
 *
 * @param {import('socket.io').Socket['handshake']} handshake
 * @returns {string[]}
 */
export function collectHandshakeTokens(handshake) {
  const cookies = parseCookies(handshake?.headers?.cookie);
  const cookieTok = cookies[ACCESS_TOKEN_COOKIE] ?? null;
  const authPayload = /** @type {any} */ (handshake?.auth);
  const authTok = typeof authPayload?.token === 'string' ? authPayload.token.trim() : '';
  const header = handshake?.headers?.authorization;
  const bearer = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const ordered = [];
  if (cookieTok) ordered.push(cookieTok);
  if (authTok) ordered.push(authTok);
  if (bearer) ordered.push(bearer);
  const seen = new Set();
  return ordered.filter((t) => {
    if (!t || seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

/**
 * @param {import('socket.io').Socket['handshake']} handshake
 * @param {ReturnType<import('../services/tokenService.js').createTokenService>} tokenService
 */
export async function authenticateSocketHandshake(handshake, tokenService) {
  const tokens = collectHandshakeTokens(handshake);
  let lastErr = null;
  for (const raw of tokens) {
    try {
      const ctx = await resolveSocketCredential(raw, { tokenService });
      return ctx;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr instanceof Error) {
    throw lastErr;
  }
  const e = new Error('UNAUTHENTICATED');
  /** @type {any} */ (e).code = 'UNAUTHENTICATED';
  throw e;
}

/**
 * @param {{
 *   tokenService: ReturnType<import('../services/tokenService.js').createTokenService>,
 *   logger: import('pino').Logger,
 *   nsTag: string,
 * }} params
 */
export function createSocketAuthMiddleware({ tokenService, logger, nsTag }) {
  return async (socket, next) => {
    try {
      const ctx = await authenticateSocketHandshake(socket.handshake, tokenService);
      socket.data.userId = ctx.id;
      socket.data.username = ctx.username;
      socket.data.roles = ctx.roles;
      socket.data.sid = ctx.sid;
      const user = await userRepository.findByIdLean(ctx.id);
      const { avatarUrl, avatarEmoji } = avatarFromUser(user);
      socket.data.avatarUrl = avatarUrl;
      socket.data.avatarEmoji = avatarEmoji;
      bumpMetric('socket_handshake_ok');
      return next();
    } catch (err) {
      bumpMetric('socket_handshake_fail');
      logger.debug({ err, event: `${nsTag}_handshake_rejected`, socketId: socket.id }, nsTag);
      const code =
        err && typeof err === 'object' && 'code' in err && typeof /** @type {any} */ (err).code === 'string'
          ? /** @type {any} */ (err).code
          : 'UNAUTHENTICATED';
      return next(new Error(code === 'SESSION_REVOKED' ? 'SESSION_REVOKED' : 'UNAUTHENTICATED'));
    }
  };
}
