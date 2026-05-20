# Redis and multi-instance Socket.IO

## Current state

Game rooms for CAH, Taboo, Hangman, and Typing Race live **in process memory** on the Node server. NPAT persists room metadata in MongoDB but still coordinates live play through the same in-memory socket layer.

Deploying **more than one API replica** without a shared adapter means:

- Players on different instances do not see the same room roster or events.
- `session_resumed` and `get_room_state` may target the wrong process.
- Rematch and lobby transitions can silently fail.

This is tracked as **TD-03** in the architecture audit.

## Target architecture (Phase 20 spike)

1. **Socket.IO Redis adapter** (`@socket.io/redis-adapter`) on all Node processes.
2. **Room authority** remains per-game managers; only pub/sub transport is shared.
3. **NPAT** continues to use Mongo for durable room documents; in-memory engines stay ephemeral but consistent across replicas via adapter events.
4. **Sticky sessions** at the load balancer are optional once the adapter is enabled, but still recommended for admission JWT refresh churn.

## Rollout checklist

- [ ] Provision Redis (Render Key Value, Upstash, or managed Redis).
- [ ] Add `REDIS_URL` to backend env; wire adapter in `socketServer.js`.
- [ ] Load-test: two clients, two replicas, same room code — roster updates propagate.
- [ ] Failure test: kill one replica mid-round — surviving replica receives disconnect cleanup.
- [ ] Document rollback: single-replica deploy remains valid without Redis.

## Until Redis ships

- Run **one** backend instance in production.
- Do not scale the socket host horizontally without the adapter.
- Wave 1–3 client stability work (session invalidation, `useGameSocket`, rejoin UX) remains valid and reduces user pain on a single instance.

## Related client work

- `RoomSession` helpers persist last room codes and suppress flags.
- `RejoinRoomPrompt` gives a consistent rejoin path after reload.
- Logout and refresh death call `dispatchSessionInvalidated` so sockets tear down before cookies are stale.
