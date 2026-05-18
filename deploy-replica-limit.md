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

## Related checks

- Auth and same-origin proxy: [deploy-auth-checklist.md](deploy-auth-checklist.md)
- Verify proxy and socket URL after deploy: `npm run smoke:auth-proxy` (set `API_PROXY_TARGET` and `FRONTEND_URL`)
- Client env: `NEXT_PUBLIC_SOCKET_URL` must point at the same backend host players use for sockets

## Client defense in depth

The typing-race UI retries once on `ROOM_NOT_FOUND` after create (see `MultiRaceRoomView.jsx`). That mitigates rare races but does **not** replace a single-replica or sticky-session deployment.
