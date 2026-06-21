import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../constants/auth.js';
import { parseDurationToMs } from '../utils/parseDuration.js';
import { readAccessToken } from '../middleware/authMiddleware.js';
import { AppError } from '../errors/AppError.js';
import { recordAuthRefresh } from '../observability/platformMetrics.js';
import { recordLoginFailure } from '../observability/authAbuseMonitor.js';
import { getPlatformSettingsCached } from '../services/platformSettingsService.js';
import { safeNextPath } from '../utils/safeNextPath.js';
import { userRepository } from '../repositories/userRepository.js';
import { usernameFieldSchema } from '../validation/auth.schemas.js';

/**
 * @param {{
 *   authService: ReturnType<import('../services/authService.js').createAuthService>,
 *   env: import('../config/env.js').Env,
 *   tokenService: ReturnType<import('../services/tokenService.js').createTokenService>,
 *   googleAuthService: ReturnType<import('../services/googleAuthService.js').createGoogleAuthService>,
 *   googleOAuthClient: ReturnType<import('../services/googleOAuthClient.js').createGoogleOAuthClient> | null,
 *   oauthStateService: ReturnType<import('../services/oauthStateService.js').createOAuthStateService>,
 * }} params
 */
export function createAuthController({
  authService,
  env,
  tokenService,
  googleAuthService,
  googleOAuthClient,
  oauthStateService,
}) {
  const cookieBase = () => ({
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });

  /**
   * @param {import('express').Response} res
   * @param {string} accessToken
   * @param {string} refreshToken
   */
  function setAuthCookies(res, accessToken, refreshToken) {
    const accessMs = parseDurationToMs(env.JWT_ACCESS_EXPIRY);
    const refreshMs = parseDurationToMs(env.JWT_REFRESH_EXPIRY);
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, { ...cookieBase(), maxAge: accessMs });
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, { ...cookieBase(), maxAge: refreshMs });
  }

  /**
   * @param {import('express').Response} res
   */
  function clearAuthCookies(res) {
    const base = cookieBase();
    res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, maxAge: 0 });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { ...base, maxAge: 0 });
  }

  function requestMeta(req) {
    return {
      userAgent: req.get('user-agent')?.slice(0, 256),
      ip: req.ip,
    };
  }

  function assertGoogleOAuthReady() {
    const runtimeEnabled = getPlatformSettingsCached().googleOAuthEnabled;
    if (!env.GOOGLE_OAUTH_ENABLED || !runtimeEnabled) {
      throw new AppError(503, 'Google sign-in is disabled', {
        code: 'GOOGLE_OAUTH_DISABLED',
        expose: true,
      });
    }
    if (!googleOAuthClient?.isConfigured) {
      throw new AppError(503, 'Google sign-in is not configured', {
        code: 'GOOGLE_OAUTH_DISABLED',
        expose: true,
      });
    }
  }

  /**
   * @param {Record<string, string>} params
   */
  function frontendOAuthCompleteRedirectUrl(params) {
    const base = String(env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
    const qs = new URLSearchParams(params);
    return `${base}/auth/google/complete?${qs.toString()}`;
  }

  return {
    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async register(req, res) {
      const result = await authService.register(req.body, requestMeta(req));
      setAuthCookies(res, result.accessToken, result.refreshToken);
      req.log?.info({ event: 'auth_register_success', userId: result.user._id }, 'auth_event');
      res.status(201).json({
        data: {
          user: result.user,
        },
      });
    },

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async login(req, res) {
      try {
        const result = await authService.login(req.body, requestMeta(req));
        setAuthCookies(res, result.accessToken, result.refreshToken);
        req.log?.info({ event: 'auth_login_success', userId: result.user._id }, 'auth_event');
        res.status(200).json({
          data: {
            user: result.user,
          },
        });
      } catch (err) {
        if (err?.code === 'INVALID_CREDENTIALS') {
          recordLoginFailure(req.ip);
          req.log?.warn({ event: 'auth_login_failure' }, 'auth_event');
        }
        throw err;
      }
    },

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async refresh(req, res) {
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      if (!refreshToken) {
        clearAuthCookies(res);
        req.log?.warn(
          { event: 'auth_refresh_failure', reason: 'missing_refresh_cookie' },
          'auth_event',
        );
        throw new AppError(401, 'Invalid credentials', { code: 'INVALID_REFRESH', expose: true });
      }
      try {
        const result = await authService.refresh(refreshToken, requestMeta(req));
        setAuthCookies(res, result.accessToken, result.refreshToken);
        recordAuthRefresh({
          ok: true,
          grace: Boolean(result.concurrentRefreshMerged),
        });
        req.log?.info({ event: 'auth_refresh', userId: result.user._id }, 'auth_event');
        res.status(200).json({
          data: {
            user: result.user,
          },
        });
      } catch (err) {
        recordAuthRefresh({ ok: false });
        clearAuthCookies(res);
        req.log?.warn(
          {
            event: 'auth_refresh_failure',
            reason: err?.code ?? 'unknown',
          },
          'auth_event',
        );
        throw err;
      }
    },

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async logout(req, res) {
      const token = readAccessToken(req);
      const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      try {
        if (token) {
          await authService.logout(token);
        } else if (refreshToken) {
          await authService.logoutByRefresh(refreshToken);
        }
      } catch {
        req.log?.debug({ event: 'auth_logout_token_invalid' }, 'auth_event');
      }
      clearAuthCookies(res);
      req.log?.info({ event: 'auth_logout' }, 'auth_event');
      res.status(204).send();
    },

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async logoutAll(req, res) {
      const token = readAccessToken(req);
      if (!token) {
        throw new AppError(401, 'Authentication required', { code: 'UNAUTHENTICATED', expose: true });
      }
      await authService.logoutAll(token);
      clearAuthCookies(res);
      req.log?.info({ event: 'auth_logout_all', userId: req.user?.id }, 'auth_event');
      res.status(204).send();
    },

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async me(req, res) {
      const user = await authService.me(req.user.id);
      res.status(200).json({ data: { user } });
    },

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async socketHandshake(req, res) {
      const token = readAccessToken(req);
      if (!token) {
        throw new AppError(401, 'Authentication required', { code: 'UNAUTHENTICATED', expose: true });
      }
      res.status(200).json({ data: { token } });
    },

    async socketAdmission(req, res) {
      const admission = await tokenService.signSocketAdmissionToken(
        req.user.id,
        req.user.roles,
        req.user.sid,
      );
      res.status(200).json({
        data: {
          token: admission,
          expiresIn: env.JWT_SOCKET_ADMISSION_EXPIRY,
        },
      });
    },

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async googleStart(req, res) {
      assertGoogleOAuthReady();
      const next = safeNextPath(typeof req.query.next === 'string' ? req.query.next : '/');
      const state = await oauthStateService.signOAuthState(next);
      const url = googleOAuthClient.getAuthorizationUrl(state);
      req.log?.info({ event: 'auth_google_start', next }, 'auth_event');
      res.redirect(302, url);
    },

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async googleCallback(req, res) {
      const nextFallback = safeNextPath(typeof req.query.next === 'string' ? req.query.next : '/');

      if (req.query.error === 'access_denied') {
        req.log?.info({ event: 'auth_google_failure', reason: 'google_cancelled' }, 'auth_event');
        res.redirect(
          302,
          frontendOAuthCompleteRedirectUrl({ error: 'google_cancelled', next: nextFallback }),
        );
        return;
      }

      try {
        assertGoogleOAuthReady();
        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const state = typeof req.query.state === 'string' ? req.query.state : '';
        if (!code || !state) {
          throw new AppError(400, 'Google sign-in failed', {
            code: 'GOOGLE_OAUTH_FAILED',
            expose: true,
          });
        }

        const { next } = await oauthStateService.verifyOAuthState(state);
        const profile = await googleOAuthClient.exchangeCodeForProfile(code);
        const outcome = await googleAuthService.resolveGoogleCallback(profile);

        if (outcome.kind === 'signup') {
          const signupTicket = await googleAuthService.createSignupTicket(profile, env);
          req.log?.info({ event: 'auth_google_callback_signup_ticket' }, 'auth_event');
          res.redirect(
            302,
            frontendOAuthCompleteRedirectUrl({ oauth_signup_ticket: signupTicket, next }),
          );
          return;
        }

        const ticket = await googleAuthService.createCompletionTicket(outcome.user, env);
        req.log?.info(
          { event: 'auth_google_callback_ticket', userId: String(outcome.user._id) },
          'auth_event',
        );
        res.redirect(
          302,
          frontendOAuthCompleteRedirectUrl({ oauth_ticket: ticket, next }),
        );
      } catch (err) {
        const reason = err instanceof AppError && err.code ? String(err.code) : 'GOOGLE_OAUTH_FAILED';
        req.log?.warn({ event: 'auth_google_failure', reason }, 'auth_event');
        res.redirect(302, frontendOAuthCompleteRedirectUrl({ error: reason, next: nextFallback }));
      }
    },

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async oauthComplete(req, res) {
      assertGoogleOAuthReady();
      const ticket = req.body.ticket;
      const user = await googleAuthService.consumeCompletionTicket(ticket);
      const result = await authService.completeAuthSession(
        { _id: user._id, roles: user.roles },
        requestMeta(req),
      );
      setAuthCookies(res, result.accessToken, result.refreshToken);
      req.log?.info(
        { event: 'auth_google_callback_success', userId: result.user._id },
        'auth_event',
      );
      res.status(200).json({ data: { user: result.user } });
    },

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async oauthSignupPreview(req, res) {
      assertGoogleOAuthReady();
      const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : '';
      if (!ticket) {
        throw new AppError(400, 'Sign-up link expired', {
          code: 'OAUTH_SIGNUP_TICKET_INVALID',
          expose: true,
        });
      }
      const profile = await googleAuthService.peekSignupTicket(ticket);
      res.status(200).json({
        data: {
          email: profile.email,
          name: profile.name,
        },
      });
    },

    async usernameAvailable(req, res) {
      const parsed = usernameFieldSchema.safeParse(req.query.username);
      if (!parsed.success) {
        res.status(200).json({ data: { available: false } });
        return;
      }
      const excludeUserId = typeof req.query.excludeUserId === 'string' ? req.query.excludeUserId.trim() : '';
      let taken;
      if (excludeUserId) {
        taken = await userRepository.findByUsernameExcluding(parsed.data, excludeUserId);
      } else {
        taken = await userRepository.findByUsername(parsed.data);
      }
      res.status(200).json({ data: { available: !taken } });
    },

    /**
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async oauthRegister(req, res) {
      assertGoogleOAuthReady();
      const { ticket, username } = req.body;
      const profile = await googleAuthService.consumeSignupTicket(ticket);
      const user = await googleAuthService.registerGoogleUser(profile, username);
      const result = await authService.completeAuthSession(
        { _id: user._id, roles: user.roles },
        requestMeta(req),
      );
      setAuthCookies(res, result.accessToken, result.refreshToken);
      req.log?.info(
        { event: 'auth_google_callback_success', userId: result.user._id },
        'auth_event',
      );
      res.status(200).json({ data: { user: result.user } });
    },
  };
}
