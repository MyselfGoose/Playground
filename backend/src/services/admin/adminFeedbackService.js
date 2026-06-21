import { AppError } from '../../errors/AppError.js';
import { listGithubIssues } from '../githubIssueClient.js';

/**
 * @param {import('../../config/env.js').Env} env
 */
export function createAdminFeedbackService(env) {
  return {
    /**
     * @param {{ page?: number, perPage?: number, state?: 'open' | 'closed' | 'all' }} [opts]
     */
    async listIssues({ page = 1, perPage = 30, state = 'open' } = {}) {
      if (!env.GITHUB_TOKEN?.trim()) {
        throw new AppError(503, 'GitHub not configured', { code: 'GITHUB_NOT_CONFIGURED', expose: true });
      }
      const owner = env.GITHUB_OWNER;
      const repo = env.GITHUB_REPO;
      if (!owner || !repo) {
        throw new AppError(503, 'GitHub repo not configured', { code: 'GITHUB_NOT_CONFIGURED', expose: true });
      }

      return listGithubIssues({
        token: env.GITHUB_TOKEN,
        owner,
        repo,
        page,
        perPage,
        state,
      });
    },
  };
}
