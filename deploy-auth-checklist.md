# Auth & OAuth deploy checklist (mobile-safe)

Use this checklist when deploying Playground so sign-in, refresh cookies, and Google OAuth work on desktop and mobile browsers.

## Recommended: same-origin API proxy (Vercel + Railway)

Browsers treat `Set-Cookie` from the **same host** as the Next.js app as first-party cookies. This avoids iOS/Android blocking third-party cookies.

### Vercel (frontend)

| Variable | Value |
|----------|--------|
| `API_PROXY_TARGET` | `https://<your-railway-api-host>` (no trailing slash) |
| `NEXT_PUBLIC_SAME_ORIGIN_API` | `1` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://<your-railway-api-host>` |
| `NEXT_PUBLIC_API_URL` | **Unset** when using same-origin mode |

`next.config.mjs` rewrites `/api/v1/*` to `API_PROXY_TARGET` when set.

### Railway (backend)

| Variable | Value |
|----------|--------|
| `CORS_ORIGIN` | Exact Vercel URL(s), e.g. `https://your-app.vercel.app` (comma-separated if multiple) |
| **Max instances** | **1** until party games use an external room store (in-memory rooms are single-instance) |
| **Health check** | `/health/ready` (waits for MongoDB auth; do not use `/health` alone) |
| `COOKIE_DOMAIN` | **Leave unset** for same-origin proxy |
| `NODE_ENV` | `production` |

Cookies should use `Secure` and appropriate `SameSite` (see [backend auth flow](backend/src/docs/auth-flow.md)).

## Legacy: cross-origin API (`NEXT_PUBLIC_API_URL` only)

- Cookies are set on the API host, not the Next host — **unreliable on mobile** (third-party cookie restrictions).
- Only use for local dev or legacy deployments.
- If required: set `CORS_ORIGIN` to the frontend origin and configure `COOKIE_DOMAIN` only when both hosts share a registrable parent domain (e.g. `.example.com`).

## Google OAuth

- OAuth redirect URLs must match the **public frontend origin** (Vercel URL or custom domain).
- Local dev: use `http://localhost:3000` in Google Cloud Console and ensure the backend allows that origin in `CORS_ORIGIN`.
- After deploy, test Google sign-in on a real phone (Safari/Chrome), not only desktop.

## SameSite & secure cookies

- Production: HTTPS only; cookies should be `Secure`.
- Same-origin proxy: `SameSite=Lax` (or stricter) is typically sufficient for refresh + session flows.
- Cross-origin: may require `SameSite=None; Secure` and still fail on some mobile browsers.

## Verify

```bash
# From repo root, with env pointing at your deployment
npm run smoke:auth-proxy
```

Set `FRONTEND_URL` and `API_PROXY_TARGET` (or backend URL) per script docs.

Run after every production deploy (manual or post-deploy hook):

```bash
npm run smoke:auth-proxy
```

If the smoke test fails, do not promote the deployment until env vars and Railway replica count are corrected.

## Further reading

- [backend/src/docs/auth-flow.md](backend/src/docs/auth-flow.md) — cookie names, refresh rotation, debugging
- [frontend/README.md](frontend/README.md) — local dev and env overview
