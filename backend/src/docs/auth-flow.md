# Authentication flow

## Overview

The API uses **JWT access tokens** (short-lived) plus **JWT refresh tokens** (long-lived), backed by a **MongoDB `RefreshSession`** document per device/session.

- **Access token** payload: `typ: 'access'`, `sub` (user id), `roles` (from issuance), `sid` (equals the refresh session `jti` so logout can revoke the correct row).
- **Refresh token** payload: `typ: 'refresh'`, `sub`, standard **`jti`** claim (opaque UUID identifying the `RefreshSession` row).

Access and refresh secrets **must differ** (`JWT_ACCESS_SECRET` vs `JWT_REFRESH_SECRET`).

## Transport

- **Browser-friendly:** httpOnly cookies `access_token` and `refresh_token` (`Secure`, `SameSite`, and optional `Domain` from env).
- **API / Postman:** send `Authorization: Bearer <access_token>` for protected routes. **No JWT is returned in the JSON body** — the access and refresh tokens live only in cookies (copy the `Set-Cookie` values for scripted testing).

## Session liveness (server-side revocation)

`requireAuth` (and the Socket.IO handshake) verify the access JWT **and** confirm that the associated `RefreshSession` (keyed by the JWT's `sid`) is still `revokedAt: null`, `replacedByJti: null`, and not expired. Logging out therefore invalidates access tokens immediately — clients receive `401 SESSION_REVOKED` on subsequent requests rather than waiting for the access JWT to expire.

## Login

1. Client `POST /api/v1/auth/login` with credentials.
2. Server validates password, creates a `RefreshSession` with a new `jti` and `expiresAt`.
3. Server issues access + refresh JWTs and sets cookies.
4. Client calls protected routes with cookies or `Authorization` header.

## Refresh (rotation)

1. Client `POST /api/v1/auth/refresh` with `refresh_token` cookie.
2. Server verifies the refresh JWT signature + expiry.
3. Server **atomically** updates the matching `RefreshSession` row (`findOneAndUpdate` guarded by `revokedAt: null`, `replacedByJti: null`, `expiresAt > now`) to set `replacedByJti: <newJti>` and `revokedAt: <now>`. Exactly one concurrent caller wins.
4. On win, the server creates a new `RefreshSession` row for the new `jti`, issues new JWTs, and resets cookies.
5. On loss (update returned null), the server inspects the row: if it is already revoked/replaced the refresh token is **reused** → **all** sessions for the user are revoked (`TOKEN_REUSE`); if expired → `SESSION_EXPIRED`; if missing → `INVALID_REFRESH`.
6. **Any refresh failure clears both auth cookies** before responding 401 so the client stops replaying a bad token.

## Logout (single device)

1. Client `POST /api/v1/auth/logout` with a still-valid access token (cookie or bearer) when possible.
2. Server reads `sid` from the access token, revokes the matching `RefreshSession` by `jti`, clears cookies.
3. If the access token is expired, cookies are still cleared; server-side revoke may be skipped.

## Logout (all devices)

1. Client `POST /api/v1/auth/logout-all` with valid access auth (`requireAuth`).
2. Server revokes **every** non-revoked `RefreshSession` for that user and clears cookies.

## `/me`

`GET /api/v1/auth/me` runs `requireAuth`: verifies access JWT, loads the user from MongoDB (so `isActive` and roles stay authoritative), returns the user JSON without `passwordHash`.

## Optional role checks

Use `optionalRoleGuard('admin')` **after** `requireAuth` on routes that must be admin-only. Example (future):

```js
router.delete('/admin/users/:id', requireAuth, optionalRoleGuard('admin'), handler);
```
