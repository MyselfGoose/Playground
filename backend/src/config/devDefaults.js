/**
 * Local development defaults when variables are unset.
 * Never used when NODE_ENV is `production` (see env.js / scripts).
 */
export const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/games_platform';

/** Distinct 64-char placeholders; replace in production with real secrets. */
export const DEFAULT_JWT_ACCESS_SECRET =
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';

export const DEFAULT_JWT_REFRESH_SECRET =
  'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3';

/** Seed script only — matches .env.example suggestion. */
export const DEFAULT_SEED_ADMIN_PASSWORD = 'ChangeThis!Strong12';
export const DEFAULT_SEED_USER_PASSWORD = 'ChangeThis!Strong12';
