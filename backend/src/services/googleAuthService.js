import { AppError } from '../errors/AppError.js';
import { userRepository } from '../repositories/userRepository.js';
import { oauthCompletionTicketRepository } from '../repositories/oauthCompletionTicketRepository.js';
import { deriveUniqueUsername } from '../utils/deriveUsername.js';
import { newJti } from '../utils/crypto.js';
import { parseDurationToMs } from '../utils/parseDuration.js';

/**
 * @param {{
 *   logger?: import('pino').Logger,
 *   userRepository?: typeof userRepository,
 *   oauthCompletionTicketRepository?: typeof oauthCompletionTicketRepository,
 * }} [deps]
 */
export function createGoogleAuthService(deps = {}) {
  const log = deps.logger;
  const users = deps.userRepository ?? userRepository;
  const tickets = deps.oauthCompletionTicketRepository ?? oauthCompletionTicketRepository;

  function isDuplicateKeyError(err) {
    return Boolean(err && typeof err === 'object' && /** @type {any} */ (err).code === 11000);
  }

  /**
   * @param {import('./googleOAuthClient.js').GoogleProfile} profile
   * @param {{ userAgent?: string, ip?: string }} _meta
   */
  async function resolveGoogleUser(profile) {
    if (!profile.emailVerified) {
      throw new AppError(401, 'Google email is not verified', {
        code: 'GOOGLE_EMAIL_UNVERIFIED',
        expose: true,
      });
    }

    const byGoogle = await users.findByGoogleId(profile.sub);
    if (byGoogle) {
      if (!byGoogle.isActive) {
        throw new AppError(401, 'Invalid credentials', { code: 'USER_INACTIVE', expose: true });
      }
      await users.updateLastLogin(byGoogle._id);
      return byGoogle;
    }

    const byEmail = await users.findByEmail(profile.email);
    if (byEmail) {
      if (byEmail.googleId && byEmail.googleId !== profile.sub) {
        throw new AppError(409, 'Google account conflict', {
          code: 'GOOGLE_ACCOUNT_CONFLICT',
          expose: true,
        });
      }

      const withPassword = await users.findByEmailWithPassword(profile.email);
      const providersBefore = Array.isArray(byEmail.authProviders) ? [...byEmail.authProviders] : ['local'];
      const hasPassword = Boolean(withPassword?.passwordHash);
      const isAutoLink =
        hasPassword && !byEmail.googleId && profile.emailVerified;

      const providersAfter = providersBefore.includes('google')
        ? providersBefore
        : [...providersBefore, 'google'];

      if (isAutoLink) {
        log?.info(
          {
            event: 'auto_link_event',
            userId: String(byEmail._id),
            googleId: profile.sub,
            authProvidersBefore: providersBefore,
            authProvidersAfter: providersAfter,
          },
          'auth_event',
        );
      }

      const linked = await users.linkGoogleAccount(byEmail._id, {
        googleId: profile.sub,
        avatarUrl: profile.picture,
        authProviders: providersAfter,
      });
      if (!linked) {
        const again = await users.findByGoogleId(profile.sub);
        if (again) return again;
        throw new AppError(409, 'Google account conflict', {
          code: 'GOOGLE_ACCOUNT_CONFLICT',
          expose: true,
        });
      }

      log?.info(
        {
          event: 'auth_google_link',
          userId: String(linked._id),
          googleId: profile.sub,
          autoLink: isAutoLink,
        },
        'auth_event',
      );
      await users.updateLastLogin(linked._id);
      return linked;
    }

    const username = await deriveUniqueUsername(profile.name, users);
    let created;
    try {
      created = await users.createUser({
        username,
        email: profile.email,
        googleId: profile.sub,
        authProviders: ['google'],
        avatarUrl: profile.picture ?? undefined,
        roles: ['user'],
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        const existing = await users.findByGoogleId(profile.sub);
        if (existing) return existing;
        const byMail = await users.findByEmail(profile.email);
        if (byMail) {
          return resolveGoogleUser(profile);
        }
      }
      throw err;
    }

    log?.info(
      { event: 'auth_google_register', userId: String(created._id), googleId: profile.sub },
      'auth_event',
    );
    await users.updateLastLogin(created._id);
    return created;
  }

  return {
    resolveGoogleUser,

    /**
     * @param {{ _id: unknown, roles: string[] }} user
     * @param {import('../config/env.js').Env} env
     */
    async createCompletionTicket(user, env) {
      const jti = newJti();
      const ttlMs = parseDurationToMs(env.OAUTH_TICKET_EXPIRY ?? '60s');
      const expiresAt = new Date(Date.now() + ttlMs);
      await tickets.create({
        jti,
        userId: user._id,
        expiresAt,
      });
      return jti;
    },

    /**
     * @param {string} ticketJti
     */
    async consumeCompletionTicket(ticketJti) {
      const userId = await tickets.consume(ticketJti);
      if (!userId) {
        throw new AppError(401, 'Sign-in link expired', {
          code: 'OAUTH_TICKET_INVALID',
          expose: true,
        });
      }
      const user = await users.findByIdLean(userId);
      if (!user?.isActive) {
        throw new AppError(401, 'Invalid credentials', { code: 'USER_INACTIVE', expose: true });
      }
      return user;
    },
  };
}
