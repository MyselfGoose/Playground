# Playgrounds deployment topology (realtime)

This backend hosts **Socket.IO namespaces** with **in-memory room state** for several games (typing race, hangman, taboo, CAH). NPAT hydrates room metadata from Mongo but still keeps active engines in process memory.

## Tier A — Single replica or sticky sessions (current baseline)

- Run **one backend instance**, **or**
- Run multiple instances behind a load balancer only if **every socket connection for a given room is pinned** to the same process (sticky sessions / consistent hashing by client id — operationally fragile).

**What breaks without stickiness:** players hit different nodes → “room not found”, partial broadcasts, mid-game disconnects.

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
- **`GET /health/metrics`** — in-process counters (refresh, handshake failures, cron completions).

## Environment

See `.env.example` for:

- `JWT_SOCKET_ADMISSION_EXPIRY` — short-lived Socket.IO admission JWT.
- `REFRESH_CONCURRENT_GRACE_MS` — multi-tab refresh merge window.
