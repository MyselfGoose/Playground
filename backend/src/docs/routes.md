# API routes

Base URL: `http://localhost:4000` (or your configured `PORT`).

All JSON responses use either:

- Success: `{ "data": ... }`
- Error: `{ "error": { "message": string, "requestId": string, "code"?: string, "stack"?: string } }`  
  (`code` is present for operational `AppError`s; `stack` only in `development`.)

---

## Health and platform

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/health` | No | Liveness / uptime JSON. |
| GET | `/` | No | API stub message. |
| GET | `/api/v1` | No | API version stub message. |

### `GET /health`

**Response 200**

```json
{ "ok": true, "uptime": 1.23, "version": "1.0.0" }
```

---

## Authentication (`/api/v1/auth`)

Cookies (httpOnly): `access_token`, `refresh_token` — set on register, login, and refresh.  
For API clients (e.g. Postman), you can also send `Authorization: Bearer <access_token>`.

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/v1/auth/register` | No | Create user; sets cookies; returns `{ user }` in body. |
| POST | `/api/v1/auth/login` | No | Login with **either** `email` or `username` plus `password`. |
| POST | `/api/v1/auth/refresh` | Refresh cookie | Rotate refresh session; new cookies. |
| POST | `/api/v1/auth/logout` | Optional access | Revokes refresh session for current access `sid` when token parses; always clears cookies. |
| POST | `/api/v1/auth/logout-all` | Access JWT required | Revokes **all** refresh sessions for the user; clears cookies. |
| GET | `/api/v1/auth/me` | Access JWT required | Returns current user document (no password hash). |

Rate limiting: `POST /register` and `POST /login` use a **stricter** limiter (`AUTH_RATE_LIMIT_*` env). Other auth routes use the global API limiter.

---

### `POST /api/v1/auth/register`

**Body**

```json
{
  "username": "player_one",
  "email": "player@example.com",
  "password": "Password1!strong"
}
```

Password rules: minimum 12 characters, at least one uppercase, one lowercase, one digit, one special character.

**Response 201**

```json
{
  "data": {
    "user": {
      "_id": "...",
      "username": "player_one",
      "email": "player@example.com",
      "roles": ["user"],
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

Both `access_token` and `refresh_token` are set as httpOnly cookies; **no JWTs are returned in the JSON body**.

---

### `POST /api/v1/auth/login`

Provide **exactly one** of `email` or `username`.

**Body (email)**

```json
{
  "email": "player@example.com",
  "password": "Password1!strong"
}
```

**Body (username)**

```json
{
  "username": "player_one",
  "password": "Password1!strong"
}
```

**Response 200** — same shape as register `data` (`{ user }`). Cookies `access_token` + `refresh_token` are set.

**Response 401** — generic `Invalid credentials` (`code`: `INVALID_CREDENTIALS`).

---

### `POST /api/v1/auth/refresh`

**Body:** none (uses `refresh_token` cookie).

**Response 200** — same `data` shape as login.

**Response 401** — invalid / missing refresh; cookies cleared.

---

### `POST /api/v1/auth/logout`

**Headers:** optional `Authorization: Bearer <access>` or `access_token` cookie.

**Response 204** — empty body; cookies cleared.

---

### `POST /api/v1/auth/logout-all`

**Headers:** `Authorization: Bearer <access>` **or** `access_token` cookie.

**Response 204** — empty body; cookies cleared.

---

### `GET /api/v1/auth/me`

**Headers:** `Authorization: Bearer <access>` **or** `access_token` cookie.

**Response 200**

```json
{
  "data": {
    "user": { "_id": "...", "username": "...", "email": "...", "roles": ["user"], "...": "..." }
  }
}
```

---

## Friends (`/api/v1/friends`)

All routes require MongoDB readiness and an authenticated user (`access_token` cookie or `Authorization: Bearer`).

Rate limits: `POST /requests` — 20/hour per user; `GET /lookup/:username` — 60/min per user.

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/v1/friends/summary` | Bootstrap payload: friends, pending sent/received, counts |
| GET | `/api/v1/friends/` | Accepted friends list (same `friends` array as summary) |
| GET | `/api/v1/friends/lookup/:username` | Resolve username → user stub + `relationship` |
| POST | `/api/v1/friends/requests` | Send friend request by username |
| POST | `/api/v1/friends/requests/:requestId/accept` | Accept received request |
| POST | `/api/v1/friends/requests/:requestId/decline` | Decline received request (visible to sender as declined) |
| DELETE | `/api/v1/friends/requests/:requestId` | Cancel own pending sent request |
| DELETE | `/api/v1/friends/:userId` | Unfriend accepted user |

### `GET /api/v1/friends/summary`

**Response 200**

```json
{
  "data": {
    "friends": [
      {
        "userId": "...",
        "username": "player_two",
        "avatarUrl": "...",
        "online": true,
        "lastSeenAt": null
      }
    ],
    "pending": {
      "received": [{ "id": "...", "from": { "userId": "...", "username": "...", "avatarUrl": "..." }, "createdAt": "..." }],
      "sent": [{ "id": "...", "to": { "userId": "...", "username": "...", "avatarUrl": "..." }, "status": "pending", "createdAt": "..." }]
    },
    "counts": { "online": 1, "pendingReceived": 0 }
  }
}
```

`online` reflects live presence from the `/social` Socket.IO namespace when the API instance has an active social hub.

### `POST /api/v1/friends/requests`

**Body**

```json
{ "username": "player_two" }
```

**Response 201** — new pending request. **Response 200** — mutual pending auto-accepted (`autoAccepted: true`).

Common errors: `CANNOT_FRIEND_SELF` (400), `USER_NOT_FOUND` (404), `ALREADY_FRIENDS` (409), `FRIEND_REQUEST_ALREADY_SENT` (409), `RATE_LIMITED` (429).

### Realtime (`/social` namespace)

Authenticated Socket.IO namespace for site-wide friend presence and request notifications.

**Server → client events:** `presence_snapshot`, `friend_online`, `friend_offline`, `friend_request_received`, `friend_request_accepted`, `friend_request_declined`, `friend_request_cancelled`, `friend_removed`.

A user is **online** while any Playground tab maintains a `/social` connection; multiple tabs do not evict each other.

---

## Role guard (internal use)

`optionalRoleGuard('admin', ...)` from [middleware/authMiddleware.js](../middleware/authMiddleware.js) is composed **after** `requireAuth` on `/api/v1/admin/*` routes.

---

## Admin API (`/api/v1/admin`)

All routes require authentication and the `admin` role. Mutations also re-verify admin from the database via `requireAdminFromDb`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Platform snapshot, live activity, popularity, health, alerts |
| GET | `/health` | Health + deployment subset |
| POST | `/actions/recompute-leaderboards` | Trigger leaderboard cron |
| PATCH | `/settings/maintenance` | Toggle maintenance mode |
| GET | `/feedback` | List GitHub feedback issues |
| GET | `/users` | Search users (`q`, `page`, `limit`) |
| GET | `/users/export` | CSV export |
| GET | `/users/:id` | User detail + stats |
| PATCH | `/users/:id` | Update user (active, roles, username, moderation) |
| DELETE | `/users/:id/avatar` | Remove avatar |
| GET/PATCH | `/users/:id/stats` | View / patch stats |
| GET | `/users/:id/matches` | Match history (all games) |
| GET | `/users/:id/audit` | Admin audit log |

Grant admin to a user: `npm run db:grant-admin` (grants `admin` role to `abubakar20069@gmail.com`).
