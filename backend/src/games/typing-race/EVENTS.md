# Typing race Socket.IO (`/typing-race`)

All client→server events use an **ack** callback: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

## Client → server

| Event | Payload | Notes |
|-------|-----------|--------|
| `typing_create_room` | `{}` | Creates room; caller is host. |
| `typing_join_room` | `{ roomCode: string }` | Digits only, length 6. |
| `typing_leave_room` | `{}` | Leaves current room. |
| `typing_set_ready` | `{ ready: boolean }` | Lobby only. |
| `typing_start_countdown` | `{}` | Host only; all ready, min 2 players. |
| `typing_progress_update` | `{ cursorDisplay, cursor, errorLen?, wpm?, clientTs? }` | Rate-limited (~45ms). |
| `typing_finish` | `{}` | Client finished passage. |
| `typing_force_end` | `{}` | Host only; ends race early. |
| `typing_reset_lobby` | `{}` | Host only; back to lobby for replay. |
| `typing_kick_player` | `{ targetUserId: string }` | Host only; lobby only; hard-removes target. |

## Server → client

| Event | Payload |
|-------|---------|
| `typing_room_updated` | `{ room }` |
| `typing_kicked` | `{ roomCode }` | Sent to the kicked socket before room leave. |
| `typing_countdown_started` | `{ room }` |
| `typing_race_started` | `{ room }` |
| `typing_peer_progress` | `{ roomCode, userId, cursorDisplay, wpm, progress01, serverTs }` |
| `typing_player_finished` | `{ room, userId, rank, dnf? }` — `rank` is `null` when `dnf` (disconnect grace expired). |
| `typing_race_finished` | `{ room, reason }` |

## Error codes

`ROOM_NOT_FOUND`, `ROOM_LOCKED`, `ROOM_FULL`, `NOT_IN_ROOM`, `FORBIDDEN`, `NOT_ALL_READY`, `NOT_ENOUGH_PLAYERS`, `BAD_PHASE`, `NOT_DONE`, `VALIDATION_ERROR`, `RATE_LIMITED`, `INTERNAL_ERROR`.

## Reconnect

Same `userId` may `typing_join_room` while race is `countdown`, `racing`, or `finished` to re-bind socket.

## Disconnect grace (racing)

If a socket drops during `racing`, the player stays in the room with `connected: false`. After `TYPING_RACE_DISCONNECT_GRACE_MS` (60s) without reconnect, the server marks them DNF (`typing_player_finished` with `dnf: true`, `rank: null`) so the race can end when everyone is accounted for.

## Load / caps

- Max players per room: `TYPING_RACE_MAX_PLAYERS` (8).  
- For manual fan-out checks, open several browser sessions (or use a Socket.IO load harness with valid JWTs) and watch CPU during `typing_progress_update` bursts; server throttles per-socket updates in handlers.

## Client UX (typing viewport + spectate)

- **Solo and multiplayer** use a fixed **3-line typing viewport** (`TypingViewport`): the page does not scroll during an active test or race; only the passage layer moves via `translateY` driven by caret position.
- **Mobile keyboard:** clients should use visual-viewport **padding-only** mode (no `scrollIntoView` on the document during typing).
- **After self-finish (multiplayer):** the finisher keeps the passage visible in **spectate mode** with live peer carets on the track until `typing_race_finished`. A sidebar shows personal stats (`SelfFinishCard`) and who is still typing.
- **`typing_finish`:** the server accepts finish when `max(cursor, cursorDisplay) >= passage.length` so throttled progress updates do not cause spurious `NOT_DONE`. Clients flush pending progress and retry finish briefly on `NOT_DONE`.

## Production deployment

Rooms live in an **in-memory** registry inside each Node process (`roomRegistry.js` in this folder). For correct behavior:

1. **Single API/WebSocket process per environment**, **or** load balancer **sticky sessions** so the same client always hits the same instance for HTTP and Socket.IO. Otherwise `typing_create_room` on instance A and `typing_join_room` on instance B yields `ROOM_NOT_FOUND`.
2. **Frontend:** `NEXT_PUBLIC_API_URL` must be the API **origin** (no `/api/v1` suffix; `frontend/src/lib/api.js` `normalizeApiBase` strips it if present).
3. **Backend:** `CORS_ORIGIN` must include the Next.js site origin so the browser can open the `/typing-race` namespace with credentials (same Socket.IO `Server` options as `npatSocket.js` in this repo).
4. Cross-site cookies: use appropriate `SameSite` / HTTPS so the access token cookie reaches the socket handshake (`typingRaceSocket.js` reads the same cookie as NPAT).

**Horizontal scaling (future):** add `@socket.io/redis-adapter` (or similar) for multi-node fan-out **and** move room state to Redis or another shared store; until then, treat typing-race as single-instance.

## Idempotent join

- **Same socket, same room:** `joinRoom` skips `leaveRoom` when `socketToRoom.get(socket.id)` already equals the target code (`alreadyInThisRoom`). Re-calling `typing_join_room` after `typing_create_room` on one connection must not destroy a solo lobby.
- **Soft disconnect, new socket:** `onSocketDisconnect` uses `hardLeave: false` in lobby so the player row stays; `typing_join_room` with the same `userId` reattaches without `ROOM_NOT_FOUND`.
- **Multi-replica:** Without sticky sessions, create and join may hit different processes → `ROOM_NOT_FOUND`. Frontend may retry once after a short delay (see BUG-007).

## Client join quirk (mitigated)

Re-joining the **same** room code on the **same** socket after create must **not** call `leaveRoom` first, or a solo lobby room is destroyed (`alreadyInThisRoom` guard in `joinRoom`).
