# Deploy runbook (multiplayer)

Operational guidance for Playgrounds backend deploys on Railway and frontend on Vercel.

## Pre-deploy checklist

- [ ] Railway **max instances = 1** unless Redis adapter is verified in staging ([deploy-replica-limit.md](../deploy-replica-limit.md))
- [ ] `INSTANCE_COUNT=1` in backend env (defense in depth)
- [ ] `REDIS_URL` set only when running ≥2 replicas with adapter wired
- [ ] Vercel `NEXT_PUBLIC_SOCKET_URL` points at the live API host
- [ ] Same-origin proxy env aligned ([deploy-auth-checklist.md](../deploy-auth-checklist.md))

## What happens during a deploy

| Game | In-memory state | Recovery after deploy |
|------|-----------------|---------------------|
| Taboo, CAH, Hangman, Typing Race | **Lost** on process restart | Clients must create/join new rooms; `session_resumed` fails if room code no longer exists |
| NPAT | Mongo metadata + graceful `flushAll()` on SIGTERM | Players reconnect; engine rehydrates from Mongo; live timers restart |

**Recommendation:** Deploy during low-traffic windows, or accept that active non-NPAT sessions will end abruptly.

Hard kills (OOM, platform crash) skip NPAT flush — in-flight NPAT state may be stale until last successful persist.

## Client recovery behavior

- **60s disconnect grace** on server matches **60s GameAuthGate hold** on client
- **Session resume:** server `attachActiveRoomForUser` + `session_resumed` + client `get_room_state`
- **Auth refresh:** unified `refreshSession()` with Web Locks (all tabs share one rotation)
- **Room codes:** scoped to `userId` in sessionStorage; cleared on logout

## Post-deploy verification

1. `GET /health` and `GET /health/ready` return 200 when Mongo is up
2. Register/login → socket-admission → connect to `/npat` namespace
3. Create a Taboo room with two browsers → play one round → refresh one tab → verify resync
4. Monitor logs for `TOKEN_REUSE` spikes (should be near zero after grace-merge retry)

## Rollback

1. Railway: redeploy previous image or revert commit
2. Scale to max instances = 1
3. Remove `REDIS_URL` if adapter caused issues
4. Verify auth cookies and CORS origins unchanged

## Scaling beyond one replica

See [redis-scaling-spike.md](../redis-scaling-spike.md) and [backend/docs/deployment-topology.md](../backend/docs/deployment-topology.md). Redis adapter synchronizes Socket.IO broadcasts only — **room maps remain per-process** until Tier C shared room store ships.
