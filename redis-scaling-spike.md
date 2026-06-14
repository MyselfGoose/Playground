# Redis scaling spike (TD-03, RC-01)

**Status:** Documentation and POC only. **Do not enable in production without ops approval.**

See also [docs/ops/redis-multi-instance.md](docs/ops/redis-multi-instance.md) and [deploy-replica-limit.md](deploy-replica-limit.md).

## Why

With **multiple Node replicas** and no shared adapter, in-memory room maps split across processes. Players see `ROOM_NOT_FOUND`, missed broadcasts, and broken reconnect (`session_resumed`, `get_room_state` on wrong instance). Tracked as **BUG-S01** / **RC-01**.

## Prerequisites (ops)

- [ ] Approved change window and rollback owner
- [ ] Managed Redis (Upstash, Render KV, ElastiCache, etc.)
- [ ] `REDIS_URL` in Railway/backend env (not Vercel)
- [ ] Load balancer or platform allows ≥2 backend instances **after** adapter verified

## Implementation steps (spike branch)

1. **Dependency:** `npm install @socket.io/redis-adapter redis --prefix backend` — **done**
2. **Wire adapter** in [`backend/src/realtime/socketServer.js`](backend/src/realtime/socketServer.js) when `env.REDIS_URL` is set — **done**
3. **Env:** add optional `REDIS_URL` to [`backend/src/config/env.js`](backend/src/config/env.js) and `.env.example`
4. **Boot:** fail fast in production if `REDIS_URL` unset when `INSTANCE_COUNT > 1` (optional guard)
5. **Room authority:** keep per-game registries in memory; adapter only synchronizes Socket.IO packets — **does not** merge room maps by itself

## What still breaks without further work

| Area | Risk |
|------|------|
| Room create on instance A, join on B | Still fails until sticky sessions **or** external room store (Tier C) |
| NPAT Mongo hydrate | Metadata durable; live engine still per-process |
| Cron / in-process metrics | Per-replica counters; use external scraper aggregation |
| Admission token refresh | Sticky sessions still help reduce churn |

## Load test plan

1. Deploy **2** backend replicas + Redis adapter on staging.
2. Two browsers, same room code:
   - Host creates on replica 1 (observe which instance via log `socketId`).
   - Guest joins on replica 2 → must receive `room_update` / roster within 2s.
3. Mid-round: `kubectl`/Railway stop one replica → surviving replica gets disconnect events; game recoverable or clean error.
4. Measure `GET /health/metrics` → `socket_handshake_fail` rate stays &lt; 1% of connects.

## Rollback

1. Scale Railway to **max instances = 1**.
2. Remove `REDIS_URL` or disable adapter wiring.
3. Redeploy single replica ([deploy-replica-limit.md](deploy-replica-limit.md)).

## Production gate

- [ ] Spike load test passed on staging
- [ ] Runbook updated; on-call knows rollback
- [ ] Ops sign-off recorded
- [ ] Only then: `max instances > 1` in production
