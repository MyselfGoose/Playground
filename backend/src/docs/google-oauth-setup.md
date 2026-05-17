# Google OAuth setup

OAuth redirects run on the **Railway API host** (not the Vercel Next.js proxy). After Google returns to the API, the backend issues a short-lived ticket and redirects the browser to the **Vercel frontend**. The SPA exchanges the ticket via `POST /api/v1/auth/oauth/complete` on the **same-origin proxy** so `access_token` / `refresh_token` cookies match email/password login.

## Flow

1. Browser → `GET https://<railway>/api/v1/auth/google?next=/games`
2. Google → `GET https://<railway>/api/v1/auth/google/callback`
3. API → `302 https://<vercel>/login?oauth_ticket=...&next=...`
4. SPA → `POST https://<vercel>/api/v1/auth/oauth/complete` (proxied to Railway)
5. API sets httpOnly cookies on the Vercel origin; SPA redirects to `next`

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

Optional: `OAUTH_TICKET_EXPIRY=60s`

### Vercel (frontend)

| Variable | Purpose |
|----------|---------|
| `API_PROXY_TARGET` | `https://<railway>` (REST + `/oauth/complete`) |
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

Click **Continue with Google** → `localhost:4000` → callback → redirect to `localhost:3000/login?oauth_ticket=...` → ticket exchange via proxy.

## D. Testing checklist

- [ ] New Google user registers and lands in app
- [ ] Existing email/password user auto-links (`auto_link_event` in API logs)
- [ ] Unverified Google email → `GOOGLE_EMAIL_UNVERIFIED` on login page
- [ ] Cancel OAuth → `google_cancelled` message
- [ ] Socket game works after Google login (admission token + cookies)
- [ ] Mobile Safari: cookies on Vercel origin after `/oauth/complete`

## Auto-link rule

Automatic link runs only when:

- User exists by email
- `passwordHash` is set (local account)
- `googleId` is null
- Google `email_verified === true`

Logs: `auto_link_event` (no raw email), then `auth_google_link`.
