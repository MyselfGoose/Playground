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

## Server → client

| Event | Payload |
|-------|---------|
| `typing_room_updated` | `{ room }` |
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
