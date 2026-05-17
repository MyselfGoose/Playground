# Google OAuth setup

OAuth redirects run on the **Railway API host** (not the Vercel Next.js proxy). After Google returns to the API, the backend redirects the browser to **`/auth/google/complete`** on the Vercel frontend. Existing users exchange a session ticket; new users pick a username, then receive cookies via the same-origin proxy.

## Flow

### Returning user (or auto-linked email)

1. Browser → `GET https://<railway>/api/v1/auth/google?next=/games`
2. Google → `GET https://<railway>/api/v1/auth/google/callback`
3. API → `302 https://<vercel>/auth/google/complete?oauth_ticket=...&next=...`
4. SPA (full-screen loader) → `POST https://<vercel>/api/v1/auth/oauth/complete` (proxied)
5. API sets cookies; SPA redirects to `next`

### New Google email

1. Steps 1–2 same as above
2. API → `302 https://<vercel>/auth/google/complete?oauth_signup_ticket=...&next=...`
3. SPA loads signup preview → user picks username → `POST /api/v1/auth/oauth/register`
4. API creates user, sets cookies; SPA redirects to `next`

## API endpoints (auth router)

| Method | Path | Proxied? |
|--------|------|----------|
| GET | `/auth/google` | No (Railway) |
| GET | `/auth/google/callback` | No (Railway) |
| POST | `/auth/oauth/complete` | Yes |
| GET | `/auth/oauth/signup-preview?ticket=` | Yes |
| GET | `/auth/username-available?username=` | Yes |
| POST | `/auth/oauth/register` | Yes |

## A. Google Cloud Console

**Authorized JavaScript origins** (SPA):

- `http://localhost:3000`
- `https://<your-vercel-app>`

**Authorized redirect URIs** (API only — not Vercel):

| Environment | URI |
|-------------|-----|
| Local | `http://localhost:4000/api/v1/auth/google/callback` |
| Production | `https://<your-railway-host>/api/v1/auth/google/callback` |

## B. Environment variables

### Railway (API)

| Variable | Example |
|----------|---------|
| `GOOGLE_OAUTH_ENABLED` | `true` |
| `GOOGLE_CLIENT_ID` | from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud |
| `GOOGLE_CALLBACK_URL` | `https://<railway>/api/v1/auth/google/callback` |
| `FRONTEND_URL` | `https://<vercel-app>` |
| `CORS_ORIGIN` | must include Vercel URL |

Optional:

- `OAUTH_TICKET_EXPIRY=60s` (session handoff)
- `OAUTH_SIGNUP_TICKET_EXPIRY=10m` (username pick)

### Vercel (frontend)

| Variable | Purpose |
|----------|---------|
| `API_PROXY_TARGET` | `https://<railway>` (REST + OAuth complete/register) |
| `NEXT_PUBLIC_SAME_ORIGIN_API` | `1` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://<railway>` (Google button + Socket.IO) |

Do **not** put Google secrets on Vercel.

## C. Local development

```bash
# Railway / backend .env
GOOGLE_OAUTH_ENABLED=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
FRONTEND_URL=http://localhost:3000

# Frontend .env.local
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_SAME_ORIGIN_API=1
API_PROXY_TARGET=http://localhost:4000
```

## D. Testing checklist

- [ ] New Google user: username screen → register → lands in app
- [ ] Returning Google user: full-screen loader → app (no login form flash)
- [ ] Existing email/password user auto-links (`auto_link_event` in API logs)
- [ ] Username taken → error on register form
- [ ] Unverified Google email → error on complete page
- [ ] Cancel OAuth → error on complete page with link to login
- [ ] Socket game after Google login
- [ ] Mobile Safari: cookies on Vercel origin after register/complete

## Auto-link rule

Automatic link runs only when:

- User exists by email
- `passwordHash` is set (local account)
- `googleId` is null
- Google `email_verified === true`

Logs: `auto_link_event` (no raw email), then `auth_google_link`.
