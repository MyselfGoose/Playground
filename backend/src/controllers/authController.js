import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../constants/auth.js';
import { parseDurationToMs } from '../utils/parseDuration.js';
import { readAccessToken } from '../middleware/authMiddleware.js';
import { AppError } from '../errors/AppError.js';

/**
 * @param {{ authService: ReturnType<import('../services/authService.js').createAuthService>, env: import('../config/env.js').Env }} params
 */
export function createAuthController({ authService, env }) {
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
        req.log?.info({ event: 'auth_refresh', userId: result.user._id }, 'auth_event');
        res.status(200).json({
          data: {
            user: result.user,
          },
        });
      } catch (err) {
        // Always clear cookies on any refresh failure so the client stops replaying a bad token.
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
     * Returns the current access token for clients that use Socket.IO `auth: { token }` because
     * some browsers or proxies do not forward cookies on the engine.io handshake the same
     * way as `fetch` with `credentials: "include"`.
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
  };
}
