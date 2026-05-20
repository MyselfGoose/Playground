# Accessibility backlog

Phase 19 (WCAG-oriented baseline) shipped the items below. Remaining work is tracked for follow-up phases.

## Shipped in Phase 19

| Acceptance criterion | Implementation |
|--------------------|----------------|
| Skip link works | [frontend/src/components/Shell.jsx](frontend/src/components/Shell.jsx) — link to `#main-content`, focusable main |
| Modals trap focus | [frontend/src/lib/a11y/useFocusTrap.js](frontend/src/lib/a11y/useFocusTrap.js) on [ConfirmDialog](frontend/src/components/taboo/ConfirmDialog.jsx), [GameRulesDrawer](frontend/src/components/game/GameRulesDrawer.jsx), Taboo review panel in [TabooPlay](frontend/src/app/games/taboo/TabooPlay.jsx) |
| ≥3 games announce turn/phase | [TurnBanner](frontend/src/app/games/hangman/components/TurnBanner.jsx) + wrong-guess live region; [TabooPhaseAnnouncer](frontend/src/app/games/taboo/TabooPhaseAnnouncer.jsx); CAH judging count in [SubmissionCenter](frontend/src/app/games/cah/components/SubmissionCenter.jsx); [NpatEvaluatingPanel](frontend/src/app/games/npat/NpatEvaluatingPanel.jsx) verified |
| axe serious = 0 on home/login | [tests/e2e/a11y-home.spec.mjs](tests/e2e/a11y-home.spec.mjs) with `@axe-core/playwright` |
| Auth form labels | Login/register already use [Input](frontend/src/components/ui/Input.jsx) with `<label htmlFor>`; Google button has `aria-label` |
| CAH keyboard selection | Arrow keys + 1–9 in SubmissionCenter |
| Hangman keyboard a11y | [LetterKeyboard](frontend/src/app/games/hangman/components/LetterKeyboard.jsx) `aria-label` per key, logical tab order |
| Contrast pass | Primary buttons use `bg-primary-dark`; Taboo body text bumped to `foreground/70–75` |

## Remaining gaps (prioritized)

### P1 — High traffic, not in CI yet

- **Authenticated axe scans:** `/games/taboo/play`, `/games/hangman` (logged-in lobby/play) need auth fixtures before CI can gate them.
- **Mobile nav drawer:** Focus return to menu trigger on close ([Navbar](frontend/src/components/Navbar.jsx)).
- **NPAT round letter:** Optional dedicated `aria-live` when `currentLetter` changes mid-session (evaluating panel already covered).

### P2 — Games and realtime

- **Typing Race:** No `aria-live` for connection phase changes; custom socket stack not migrated to shared patterns ([TypingRaceSocketContext](frontend/src/lib/typing-race/TypingRaceSocketContext.jsx)).
- **Score / roster updates:** Realtime score changes not announced (all multiplayer games).
- **Taboo timer:** TimerBar has sr-only copy in shared component; verify countdown urgency on play screen with VoiceOver.

### P3 — Product and scale

- **BUG-002:** Home vs hub game count mismatch (not a11y-specific).
- **BUG-003:** NPAT “Round scored” misleading copy.
- **E2E recovery flows:** Login → room → refresh → logout per game (see [audit/audit/ux/accessibility.md](audit/audit/ux/accessibility.md) testing plan).
- **Multi-replica:** Socket rooms need Redis adapter before horizontal scale — [docs/ops/redis-multi-instance.md](docs/ops/redis-multi-instance.md).

## Manual QA script (recommended)

1. Keyboard-only: Tab from `/` → skip link → main; open Taboo leave confirm → Tab cycles inside dialog → Escape closes.
2. VoiceOver (or NVDA): Hangman play — hear turn change and wrong-guess count.
3. VoiceOver: Taboo play — hear “Team Alpha's turn” on phase change.
4. VoiceOver: CAH judging — hear submission count.
5. `npm run test:e2e -- tests/e2e/a11y-home.spec.mjs` with dev server or CI `ci:e2e:serve`.

## References

- [audit/audit/ux/accessibility.md](audit/audit/ux/accessibility.md)
- [audit/audit/ux/ux-improvements.md](audit/audit/ux/ux-improvements.md)
