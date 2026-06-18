import { AppError } from '../errors/AppError.js';
import { userRepository } from '../repositories/userRepository.js';
import { oauthCompletionTicketRepository } from '../repositories/oauthCompletionTicketRepository.js';
import { oauthSignupTicketRepository } from '../repositories/oauthSignupTicketRepository.js';
import { newJti } from '../utils/crypto.js';
import { parseDurationToMs } from '../utils/parseDuration.js';

/**
 * @param {{
 *   logger?: import('pino').Logger,
 *   userRepository?: typeof userRepository,
 *   oauthCompletionTicketRepository?: typeof oauthCompletionTicketRepository,
 *   oauthSignupTicketRepository?: typeof oauthSignupTicketRepository,
 * }} [deps]
 */
export function createGoogleAuthService(deps = {}) {
  const log = deps.logger;
  const users = deps.userRepository ?? userRepository;
  const completionTickets = deps.oauthCompletionTicketRepository ?? oauthCompletionTicketRepository;
  const signupTickets = deps.oauthSignupTicketRepository ?? oauthSignupTicketRepository;

  /**
   * @param {import('./googleOAuthClient.js').GoogleProfile} profile
   */
  async function resolveGoogleCallback(profile) {
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
      let user = byGoogle;
      if (
        profile.picture &&
        !byGoogle.avatarEmoji &&
        !byGoogle.avatarUpdatedAt &&
        byGoogle.avatarUrl !== profile.picture
      ) {
        const updated = await users.updateProfile(byGoogle._id, { avatarUrl: profile.picture });
        if (updated) user = updated;
      }
      await users.updateLastLogin(user._id);
      return { kind: 'session', user };
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
      const isAutoLink = hasPassword && !byEmail.googleId && profile.emailVerified;

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
        if (again) {
          await users.updateLastLogin(again._id);
          return { kind: 'session', user: again };
        }
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
      return { kind: 'session', user: linked };
    }

    return { kind: 'signup', profile };
  }

  return {
    resolveGoogleCallback,

    /**
     * @param {{ _id: unknown, roles: string[] }} user
     * @param {import('../config/env.js').Env} env
     */
    async createCompletionTicket(user, env) {
      const jti = newJti();
      const ttlMs = parseDurationToMs(env.OAUTH_TICKET_EXPIRY ?? '180s');
      const expiresAt = new Date(Date.now() + ttlMs);
      await completionTickets.create({
        jti,
        userId: user._id,
        expiresAt,
      });
      return jti;
    },

    /**
     * @param {import('./googleOAuthClient.js').GoogleProfile} profile
     * @param {import('../config/env.js').Env} env
     */
    async createSignupTicket(profile, env) {
      const jti = newJti();
      const ttlMs = parseDurationToMs(env.OAUTH_SIGNUP_TICKET_EXPIRY ?? '10m');
      const expiresAt = new Date(Date.now() + ttlMs);
      await signupTickets.create({
        jti,
        googleId: profile.sub,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
        expiresAt,
      });
      return jti;
    },

    /**
     * @param {string} ticketJti
     */
    async consumeCompletionTicket(ticketJti) {
      const userId = await completionTickets.consume(ticketJti);
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

    /**
     * @param {string} ticketJti
     */
    /**
     * @param {string} ticketJti
     */
    async peekSignupTicket(ticketJti) {
      const profile = await signupTickets.peek(ticketJti);
      if (!profile) {
        throw new AppError(401, 'Sign-up link expired', {
          code: 'OAUTH_SIGNUP_TICKET_INVALID',
          expose: true,
        });
      }
      return profile;
    },

    async consumeSignupTicket(ticketJti) {
      const profile = await signupTickets.consume(ticketJti);
      if (!profile) {
        throw new AppError(401, 'Sign-up link expired', {
          code: 'OAUTH_SIGNUP_TICKET_INVALID',
          expose: true,
        });
      }
      return profile;
    },

    /**
     * @param {import('../repositories/oauthSignupTicketRepository.js').OAuthSignupProfile} profile
     * @param {string} username
     */
    async registerGoogleUser(profile, username) {
      const existingGoogle = await users.findByGoogleId(profile.googleId);
      if (existingGoogle) {
        return existingGoogle;
      }
      const existingEmail = await users.findByEmail(profile.email);
      if (existingEmail) {
        throw new AppError(409, 'Email already registered', { code: 'EMAIL_TAKEN', expose: true });
      }
      const taken = await users.findByUsername(username);
      if (taken) {
        throw new AppError(409, 'Username already taken', { code: 'USERNAME_TAKEN', expose: true });
      }

      const created = await users.createUser({
        username,
        email: profile.email,
        googleId: profile.googleId,
        authProviders: ['google'],
        avatarUrl: profile.picture ?? undefined,
        roles: ['user'],
      });

      log?.info(
        { event: 'auth_google_register', userId: String(created._id), googleId: profile.googleId },
        'auth_event',
      );
      await users.updateLastLogin(created._id);
      return created;
    },
  };
}
