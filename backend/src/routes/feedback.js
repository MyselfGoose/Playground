import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createTokenService } from '../services/tokenService.js';
import { readAccessToken, resolveAccessContext } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { feedbackBodySchema } from '../validation/feedback.schemas.js';
import {
  buildFeedbackIssueBody,
  buildFeedbackIssueTitle,
  feedbackLabelsForType,
} from '../services/feedbackIssueFormat.js';
import { createGithubIssueWithLabelFallback } from '../services/githubIssueClient.js';
import { AppError } from '../errors/AppError.js';
import {
  decodeFeedbackScreenshot,
  uploadFeedbackScreenshotToRepo,
} from '../services/feedbackScreenshot.js';

/**
 * @param {{ env: import('../config/env.js').Env }} params
 */
export function createFeedbackRouter({ env }) {
  const router = Router();
  const tokenService = createTokenService(env);

  router.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }
    next();
  });

  const feedbackLimiter = rateLimit({
    windowMs: env.FEEDBACK_RATE_LIMIT_WINDOW_MS,
    limit: env.FEEDBACK_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
    validate: { trustProxy: env.TRUST_PROXY > 0 },
    keyGenerator: (req) => req.ip ?? req.socket?.remoteAddress ?? 'unknown',
  });

  /** @type {import('express').RequestHandler} */
  async function optionalAuth(req, _res, next) {
    try {
      const token = readAccessToken(req);
      if (!token) {
        return next();
      }
      req.feedbackUser = await resolveAccessContext(token, { tokenService });
    } catch {
      // Anonymous feedback still allowed
    }
    next();
  }

  function isFeedbackConfigured() {
    const t = env.GITHUB_TOKEN?.trim();
    const o = env.GITHUB_OWNER?.trim();
    const r = env.GITHUB_REPO?.trim();
    return Boolean(t && o && r);
  }

  /** @type {import('express').RequestHandler} */
  function requireFeedbackEnabled(req, res, next) {
    if (!env.FEEDBACK_ENABLED) {
      return next(
        new AppError(503, 'Feedback is temporarily disabled.', {
          code: 'FEEDBACK_DISABLED',
          expose: true,
        }),
      );
    }
    if (!isFeedbackConfigured()) {
      return next(
        new AppError(
          503,
          'Feedback is temporarily unavailable. Please try again later.',
          { code: 'FEEDBACK_UNAVAILABLE', expose: true },
        ),
      );
    }
    next();
  }

  router.post(
    '/',
    feedbackLimiter,
    requireFeedbackEnabled,
    optionalAuth,
    validateBody(feedbackBodySchema),
    asyncHandler(async (req, res) => {
      const payload = req.body;
      const serverSubmittedAtIso = new Date().toISOString();
      const user = req.feedbackUser
        ? { id: req.feedbackUser.id, username: req.feedbackUser.username }
        : null;

      const token = env.GITHUB_TOKEN.trim();
      const owner = env.GITHUB_OWNER.trim();
      const repo = env.GITHUB_REPO.trim();

      /** @type {string | null} */
      let screenshotMarkdown = null;
      if (payload.screenshot) {
        const decoded = decodeFeedbackScreenshot(payload.screenshot, env.FEEDBACK_SCREENSHOT_MAX_BYTES);
        if (!decoded.ok) {
          throw new AppError(400, decoded.message, { code: 'VALIDATION_ERROR', expose: true });
        }
        try {
          const basePath = env.FEEDBACK_SCREENSHOTS_PATH.trim().replace(/^\/+|\/+$/g, '');
          const url = await uploadFeedbackScreenshotToRepo({
            token,
            owner,
            repo,
            basePath,
            buffer: decoded.buffer,
            ext: decoded.ext,
            log: req.log,
          });
          screenshotMarkdown = `![feedback screenshot](${url})`;
        } catch (uploadErr) {
          const st =
            uploadErr && typeof uploadErr === 'object' && 'status' in uploadErr && typeof uploadErr.status === 'number'
              ? uploadErr.status
              : 0;
          req.log?.warn(
            { err: uploadErr, githubStatus: st, event: 'feedback_screenshot_upload_failed' },
            'feedback_screenshot_upload_failed',
          );
          screenshotMarkdown =
            '_Screenshot upload failed (the issue was still created). The GitHub token needs **Contents: Read and write** on this repository, or the image was rejected by GitHub._';
        }
      }

      const title = buildFeedbackIssueTitle({ type: payload.type, title: payload.title });
      const issueBody = buildFeedbackIssueBody({
        type: payload.type,
        title: payload.title,
        description: payload.description,
        contactEmail: payload.contactEmail,
        client: payload.client ?? {},
        serverSubmittedAtIso,
        user,
        screenshotMarkdown,
      });

      const primaryLabels = feedbackLabelsForType(payload.type);
      const labelSets = [primaryLabels, ['feedback'], []];

      try {
        const created = await createGithubIssueWithLabelFallback({
          token,
          owner,
          repo,
          title,
          body: issueBody,
          labelSets,
          log: req.log,
        });

        res.status(201).json({
          data: {
            issueUrl: created.html_url,
            issueNumber: created.number,
          },
        });
      } catch (err) {
        const e = err && typeof err === 'object' ? err : {};
        const status = 'status' in e && typeof e.status === 'number' ? e.status : 0;
        const githubBody = 'githubBody' in e ? e.githubBody : undefined;
        req.log?.error(
          { err, githubStatus: status, githubBody, event: 'feedback_github_failed' },
          'feedback_github_failed',
        );

        if (status === 401 || status === 403) {
          throw new AppError(503, 'Feedback temporarily unavailable (GitHub auth).', {
            code: 'FEEDBACK_GITHUB_AUTH',
            expose: true,
          });
        }
        if (status === 404) {
          throw new AppError(503, 'Feedback temporarily unavailable.', {
            code: 'FEEDBACK_GITHUB_REPO',
            expose: true,
          });
        }
        throw new AppError(503, 'Feedback temporarily unavailable. Please try again later.', {
          code: 'FEEDBACK_GITHUB_ERROR',
          expose: true,
        });
      }
    }),
  );

  return router;
}
