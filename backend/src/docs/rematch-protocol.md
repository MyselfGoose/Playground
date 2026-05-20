# Rematch protocol

In-room rematch keeps the **same room code** and **same player roster** while resetting game state to a lobby-ready phase. Each game namespace uses **canonical socket events** (no shared `rematch_request` alias in Phase 18).

## Ack shape

All rematch handlers use the standard Socket.IO ack contract:

```json
{ "ok": true, "data": { "room": { ... } } }
```

```json
{ "ok": false, "error": { "code": "NOT_HOST", "message": "..." } }
```

Clients must merge `room` snapshots using monotonic `stateVersion` (ignore older versions).

## Per-game events

| Game | Namespace | Client emit | Broadcast | Who | Preconditions |
|------|-----------|-------------|-----------|-----|---------------|
| Hangman | `/hangman` | `play_again` | `room_update` (`reason: play_again`) | In-room with permission | `game.phase === 'game_end'` |
| Hangman | `/hangman` | `return_to_lobby` | `room_update` (`reason: returned_to_lobby`) | In-room | `game_end` or `round_end`; preserves `lobby.lastScores` |
| Typing Race | `/typing-race` | `typing_reset_lobby` | `typing_room_updated` | Host only | After race finished |
| NPAT | `/npat` | `reset_room` | `room_update` | Host only | `state === 'FINISHED'` |
| Taboo | `/taboo` | `return_to_lobby` | `room_update` (`reason: returned_to_lobby`) | Host only | `game.status === 'finished'` |
| CAH | `/cah` | `return_to_lobby` | `room_update` (`reason: returned_to_lobby`) | Host only | `game.status === 'finished'` |

## Semantics

### Hangman `play_again`

- Clears active game, auto-readies connected players, starts lobby countdown when all ready.
- Does **not** preserve series scores (use `return_to_lobby` to keep `lastScores`).

### Hangman `return_to_lobby`

- Clears game; may retain final scores on `room.lobby.lastScores` for results UI.

### Typing Race `typing_reset_lobby`

- Resets phase to `lobby`, clears race timers and per-player progress.
- Same 6-digit room code; players stay in room.

### NPAT `reset_room`

- Transitions engine `FINISHED` → `WAITING` on the **same code**.
- Clears rounds, results, timers, and submissions; resets player `ready`.
- Persists reset state to Mongo.

### Taboo / CAH `return_to_lobby`

- Sets `room.game = null`, resets player `ready`.
- CAH also resets player scores to `0` and clears revealing timers.
- Taboo clears `tabooStatsPersisted` so a new game can persist stats again.

## Client obligations

1. After a successful rematch ack, apply `data.room` via the game’s `stateVersion` merge.
2. Listen for `room_update` (and game-specific broadcasts) — ack alone may not be the last snapshot.
3. Do not navigate away from the room route unless the user explicitly leaves.
4. Surface `NOT_HOST` and `INVALID_PHASE` with actionable copy (e.g. “Only the host can start another round”).

## Future work

- Optional cross-game aliases: `rematch_request` / `rematch_ack` mapping to the table above.
- Party layer (F-01) may wrap these events with a stable party session id.
