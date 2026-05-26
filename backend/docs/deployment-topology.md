# Playgrounds deployment topology (realtime)

This backend hosts **Socket.IO namespaces** with **in-memory room state** for several games (typing race, hangman, taboo, CAH). NPAT hydrates room metadata from Mongo but still keeps active engines in process memory.

## Tier A — Single replica or sticky sessions (current baseline)

- Run **one backend instance**, **or**
- Run multiple instances behind a load balancer only if **every socket connection for a given room is pinned** to the same process (sticky sessions / consistent hashing by client id — operationally fragile).

**What breaks without stickiness:** players hit different nodes → “room not found”, partial broadcasts, mid-game disconnects.

**Operational checklist:** Before investigating “random logouts” or lost rounds in production, confirm the API/socket tier is running **exactly one replica** (or verified sticky sessions). Split-brain across nodes mimics disconnect and session loss.

**Player disconnect grace:** All party games use a **60s** server-side grace (`PLAYER_DISCONNECT_GRACE_MS`) before a disconnected player is removed from active play. Clients show a shared countdown via `graceEndsAtMs` in room snapshots.

## Tier B — Horizontal sockets

Requirements:

1. **`@socket.io/redis-adapter`** (or equivalent) so emits reach all nodes.
2. **Sticky sessions** remain recommended unless room state is externalized — shared adapter alone does **not** merge split in-memory maps.

## Tier C — HA multiplayer

- External **room store** (e.g. Redis or Mongo with a strict serialization protocol) as authoritative state.
- All mutations go through a single code path; sockets become notification transports.

## Health probes

- **`GET /health/live`** — process up.
- **`GET /health/ready`** — Mongo connected (`readyState === 1`).
- **`GET /health/metrics`** — in-process counters (`auth_refresh_ok` / `auth_refresh_fail`, `socket_handshake_ok` / `socket_handshake_fail`, `leaderboard_cron_complete`, etc.). Prometheus text at **`GET /health/metrics/prometheus`**.

## Environment

See `.env.example` for:

- `JWT_SOCKET_ADMISSION_EXPIRY` — short-lived Socket.IO admission JWT.
- `REFRESH_CONCURRENT_GRACE_MS` — multi-tab refresh merge window.
