# Backend setup

## Requirements

- Node.js **>= 20.10**
- MongoDB reachable from this machine (local `mongod`, Docker, or [Atlas](./mongodb.md))

## Install

From the `backend` directory:

```bash
npm install
```

## Environment

**Quick start (local only):** you can run `npm run dev` with no `.env` file. The server uses defaults from `src/config/devDefaults.js` (MongoDB at `mongodb://127.0.0.1:27017/games_platform` and non-production JWT secrets). You still need a reachable MongoDB on that URI.

For anything beyond solo local work, copy the example and edit values:

```bash
cp .env.example .env
```

Required in **production** (see `.env.example` for the full list). In development, unset values fall back to dev defaults except where noted:

- `MONGO_URI`
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (different values; production requires each **>= 32** characters)
- `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` (e.g. `15m`, `7d`)

Optional tuning:

- `BCRYPT_COST` (10–14, default 12)
- `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX` (login/register only)
- `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN`

## Run

Development (auto-reload on file changes):

```bash
npm run dev
```

Production-style:

```bash
npm start
```

## Database seeding

After MongoDB is running and `MONGO_URI` is set in `.env`:

```bash
npm run db:seed
```

Requires `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD` in `.env` (see `.env.example`).

## Database reset (development only)

**Never** use in production.

```bash
ALLOW_DB_RESET=true npm run db:reset
```

Also requires `NODE_ENV` not equal to `production`.

## Documentation index

- [routes.md](./routes.md) — endpoint reference
- [auth-flow.md](./auth-flow.md) — token lifecycle
- [mongodb.md](./mongodb.md) — connecting MongoDB
