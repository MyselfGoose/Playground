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

## Role guard (internal use)

`optionalRoleGuard('admin', ...)` from [middleware/authMiddleware.js](../middleware/authMiddleware.js) is intended to be composed **after** `requireAuth` on future admin routes. It is not mounted on a public URL in the starter.
