# Ops smoke test (~15 minutes)

Per-prompt manual test guides (what changed, expected UI, step-by-step checks): [`plan/manual-verification/README.md`](plan/manual-verification/README.md). This document is the **full-platform** smoke pass after multiple prompts.

Run on **staging** (or local with production-like env: same-origin proxy, `NEXT_PUBLIC_SOCKET_URL`, single backend replica). One tester, one browser; use a second device/tab only where noted.

## Pre-flight (2 min)

| Step | Pass |
|------|------|
| `GET /health` returns `ok: true` or `degraded`, not `fail` | [ ] |
| `GET /health/ready` returns `200` with `mongoReadyState: 1` | [ ] |
| `GET /health/metrics` includes `socket_handshake_ok` and `socket_handshake_fail` counters | [ ] |
| Railway (or host): **max instances = 1** for API/socket service ([deploy-replica-limit.md](deploy-replica-limit.md)) | [ ] |
| Vercel: `API_PROXY_TARGET`, `NEXT_PUBLIC_SAME_ORIGIN_API=1`, `NEXT_PUBLIC_SOCKET_URL` set ([deploy-auth-checklist.md](deploy-auth-checklist.md)) | [ ] |

Optional CLI (from repo root):

```bash
FRONTEND_URL=https://your-staging.vercel.app \
API_PROXY_TARGET=https://your-api.railway.app \
npm run smoke:auth-proxy
```

## Auth (3 min)

| Step | Pass |
|------|------|
| Register new account → lands on `/games`, navbar shows username + Sign out | [ ] |
| Log out → Login → same account works | [ ] |
| Google OAuth sign-in on **real phone** (Safari or Chrome) — manual | [ ] |

## Per-game lobby smoke (8 min)

For each game: **create room** → **party code visible** → **ready UI** → **leave** → no ghost “rejoin” prompt on hub.

| Game | Create | Code / lobby | Leave clean | Pass |
|------|--------|--------------|-------------|------|
| NPAT | Create Game | Lobby shows numeric code, Ready up | Back / leave → `/games/npat` | [ ] |
| Typing Race | Create room | Code + ready | Leave | [ ] |
| Taboo | Create room | Code + teams/ready | Leave | [ ] |
| CAH | Create room | Code + ready | Leave | [ ] |
| Hangman | Create room | Code + ready | Leave | [ ] |

### NPAT reconnect (1 min)

| Step | Pass |
|------|------|
| In NPAT lobby, refresh page → still in same room within ~10s | [ ] |
| Second player join same code (second tab/device) — **manual** | [ ] |

## Sign-off

| Field | Value |
|-------|--------|
| Environment | |
| Date | |
| Tester | |
| Notes | |

**Fail criteria:** Any game cannot create/join, auth cookies missing after login, or `/health/ready` 503.
