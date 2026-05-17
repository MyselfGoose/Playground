import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../errors/AppError.js';

/**
 * @typedef {{
 *   sub: string,
 *   email: string,
 *   emailVerified: boolean,
 *   name: string,
 *   picture: string | null,
 * }} GoogleProfile
 */

/**
 * @param {import('../config/env.js').Env} env
 */
export function createGoogleOAuthClient(env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) {
    return null;
  }

  const client = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_CALLBACK_URL,
  );

  return {
    isConfigured: true,

    /**
     * @param {string} state
     */
    getAuthorizationUrl(state) {
      return client.generateAuthUrl({
        access_type: 'online',
        scope: ['openid', 'email', 'profile'],
        prompt: 'select_account',
        state,
      });
    },

    /**
     * @param {string} code
     * @returns {Promise<GoogleProfile>}
     */
    async exchangeCodeForProfile(code) {
      try {
        const { tokens } = await client.getToken(code);
        if (!tokens.id_token) {
          throw new AppError(401, 'Google sign-in failed', {
            code: 'GOOGLE_OAUTH_FAILED',
            expose: true,
          });
        }
        const ticket = await client.verifyIdToken({
          idToken: tokens.id_token,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload?.sub || !payload.email) {
          throw new AppError(401, 'Google sign-in failed', {
            code: 'GOOGLE_OAUTH_FAILED',
            expose: true,
          });
        }
        return {
          sub: payload.sub,
          email: payload.email.toLowerCase(),
          emailVerified: payload.email_verified === true,
          name: typeof payload.name === 'string' ? payload.name : payload.email.split('@')[0],
          picture: typeof payload.picture === 'string' ? payload.picture : null,
        };
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(401, 'Google sign-in failed', {
          code: 'GOOGLE_OAUTH_FAILED',
          expose: true,
        });
      }
    },
  };
}
