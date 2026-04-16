# Authentication flow

## Overview

The API uses **JWT access tokens** (short-lived) plus **JWT refresh tokens** (long-lived), backed by a **MongoDB `RefreshSession`** document per device/session.

- **Access token** payload: `typ: 'access'`, `sub` (user id), `roles` (from issuance), `sid` (equals the refresh session `jti` so logout can revoke the correct row).
- **Refresh token** payload: `typ: 'refresh'`, `sub`, standard **`jti`** claim (opaque UUID identifying the `RefreshSession` row).

Access and refresh secrets **must differ** (`JWT_ACCESS_SECRET` vs `JWT_REFRESH_SECRET`).

## Transport

- **Browser-friendly:** httpOnly cookies `access_token` and `refresh_token` (`Secure`, `SameSite`, and optional `Domain` from env).
- **API / Postman:** send `Authorization: Bearer <access_token>` for protected routes. After login/register/refresh, the JSON body also includes **`accessToken`** for convenience; **refresh tokens are never returned in JSON** — use the cookie jar or copy the `Set-Cookie` refresh value for refresh testing.

## Login

1. Client `POST /api/v1/auth/login` with credentials.
2. Server validates password, creates a `RefreshSession` with a new `jti` and `expiresAt`.
3. Server issues access + refresh JWTs and sets cookies.
4. Client calls protected routes with cookies or `Authorization` header.

## Refresh (rotation)

1. Client `POST /api/v1/auth/refresh` with `refresh_token` cookie.
2. Server verifies refresh JWT signature + expiry, loads `RefreshSession` by `jti`.
3. If the session row is **already** `revokedAt` or has `replacedByJti`, the refresh token is **stale or reused** → all refresh sessions for that user are revoked (**logout all devices** policy for suspected token theft).
4. Otherwise server creates a **new** `RefreshSession` with a new `jti`, marks the old session rotated (`replacedByJti`, `revokedAt`), issues new JWTs, and resets cookies.

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
