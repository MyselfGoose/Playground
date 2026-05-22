# Production replica limit (multiplayer)

Until **Tier B** from [backend/docs/deployment-topology.md](backend/docs/deployment-topology.md) is implemented (Redis Socket.IO adapter plus a shared room store), run the games **backend with a maximum of one instance** on Railway (or any host).

## Why

Room state for typing race, hangman, taboo, CAH, and active NPAT engines lives **in process memory** on each Node worker. Multiple replicas without sticky sessions split players across nodes, which causes:

- `ROOM_NOT_FOUND` on join or reconnect
- Partial or missing `room_update` broadcasts
- Mid-game disconnects that look like random network failures

## What to configure

- **Railway / production:** set **max instances = 1** for the API/socket service.
- **Do not** scale horizontally for realtime games until Redis adapter and shared state are in place.
- Optional clarity: set `INSTANCE_COUNT=1` in backend environment variables (this is also the default if unset).

## Code enforcement (boot)

On startup, [`backend/src/config/env.js`](backend/src/config/env.js) validates environment via `getEnv()`:

| Variable | Default | Role |
|----------|---------|------|
| `INSTANCE_COUNT` | `1` | Declared replica count for this deploy |
| `REDIS_URL` | unset | Required when `INSTANCE_COUNT > 1` in **production** |

**Production rules:**

- `INSTANCE_COUNT=1` (default) — allowed without `REDIS_URL`.
- `INSTANCE_COUNT > 1` without `REDIS_URL` — **boot fails** (`EnvValidationError`); the process still listens on a minimal HTTP server so the platform proxy is not connection-refused, but the API and sockets do not start until env is fixed.

**Scaling later (Tier B):** after prompt 038 wires the Socket.IO Redis adapter, set both `REDIS_URL` and `INSTANCE_COUNT` to match your replica count, then increase platform max instances. See [redis-scaling-spike.md](redis-scaling-spike.md) and [backend/docs/deployment-topology.md](backend/docs/deployment-topology.md).

Railway does not inject fleet size into the process — keep **max instances = 1** as the primary control; `INSTANCE_COUNT` is defense in depth when ops declare horizontal scale.

## Related checks

- Auth and same-origin proxy: [deploy-auth-checklist.md](deploy-auth-checklist.md)
- Verify proxy and socket URL after deploy: `npm run smoke:auth-proxy` (set `API_PROXY_TARGET` and `FRONTEND_URL`)
- Client env: `NEXT_PUBLIC_SOCKET_URL` must point at the same backend host players use for sockets

## Client defense in depth

The typing-race UI retries once on `ROOM_NOT_FOUND` after create (see `MultiRaceRoomView.jsx`). That mitigates rare races but does **not** replace a single-replica or sticky-session deployment.
