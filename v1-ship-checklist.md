# v1 ship checklist

Derived from [audit/audit/polish/production-polish-checklist.md](audit/audit/polish/production-polish-checklist.md). Mark `[x]` only when verified for v1. **Target: ≥80%** (30+ of 37 items).

**Phase 20 verification:** 2026-05-20 (automated tests + code audit; staging manual via [ops-smoke-test.md](ops-smoke-test.md)).

---

## Global platform

- [x] Brand name consistent (Playground)
- [x] No fake metrics on marketing pages
- [x] All 5 games visible on home (`getPlayableGames`)
- [x] Theme single source (`frontend/src/lib/theme/ThemeContext.jsx`)
- [x] Connection errors user-friendly (`mapConnectionError` used across games)
- [ ] Auth flow works on mobile Safari with production cookie config (manual staging)
- [x] `prefers-reduced-motion` disables infinite animations (`globals.css`, game hooks)
- [x] Error boundary offers recovery path (`ErrorBoundary`, `ErrorState`)
- [x] Feedback link visible from error states (navbar + game overlays)

---

## Per-game lobby

- [x] Party code copy works (`PartyCode`)
- [x] Player list shows connected vs disconnected
- [x] Ready state clear
- [x] Start rules explained in one line
- [x] Min players warning before frustration
- [x] Leave room works without ghost state (`RejoinRoomPrompt`, leave handlers)
- [x] Reconnect restores lobby within 10s (NPAT integration + client resume)

---

## Per-game play

| Game | Critical polish items | Verified |
|------|----------------------|----------|
| NPAT | Round complete copy; evaluating source label | [x] Phase 14 |
| Typing | Mobile keyboard; connection UI simplified | [x] Phase 11 |
| Taboo | Review timeout / quorum; phase announcer | [x] Phase 12 |
| CAH | Host AFK auto-advance (30s revealing) | [x] Phase 13 |
| Hangman | Setter timeout; play again vs lobby distinct | [x] Phase 10 |

---

## Per-game results

- [x] Winner clearly named
- [x] Stats accurate vs server
- [x] CTA: Play again / New game / Leaderboard
- [x] No route bounce during reconnect
- [ ] Share or copy result (stretch)

---

## Performance

- [ ] Lighthouse LCP &lt; 2.5s home + games hub (manual Lighthouse)
- [x] No layout shift on game load (skeletons / loading states)
- [x] Taboo snapshot size reasonable for typical rooms
- [x] Single backend replica OR Redis documented ([deploy-replica-limit.md](deploy-replica-limit.md), [redis-scaling-spike.md](redis-scaling-spike.md))

---

## Accessibility (minimum)

- [x] Focus visible on interactive elements (Phase 19)
- [x] Form labels on auth
- [x] `aria-live` on phase changes (Taboo announcer, NPAT panels)
- [x] Contrast pass on primary buttons (axe home spec in CI)

---

## Testing

- [x] E2E: home loads
- [x] E2E: login/register + NPAT lobby ([tests/e2e/auth.spec.mjs](tests/e2e/auth.spec.mjs), [npat-lobby.spec.mjs](tests/e2e/npat-lobby.spec.mjs))
- [x] Integration: socket reconnect NPAT ([npat-get-room-state.test.js](tests/integration/socket/npat-get-room-state.test.js))
- [ ] Manual: 2-tab same user hangman
- [ ] Manual: OAuth on mobile

---

## Ops

- [x] `/health/ready` wired to deploy ([deployment-topology.md](backend/docs/deployment-topology.md))
- [x] Env vars documented for Vercel + Railway ([deploy-auth-checklist.md](deploy-auth-checklist.md))
- [x] Max 1 replica until Redis ([deploy-replica-limit.md](deploy-replica-limit.md))
- [x] Logs searchable for handshake failures (`socket_handshake_*` metrics + structured logs)

---

## Summary

| Checked | Total (checkbox rows) | % |
|---------|----------------------|---|
| 31 | 37 | 84% |

**Before marketing launch:** complete [ops-smoke-test.md](ops-smoke-test.md) on staging and check remaining manual rows above.
