# Performance budgets

Initial targets for Playground marketing and hub routes. Record Lighthouse scores in PR descriptions when touching performance-sensitive work.

## Targets

| Route | LCP | CLS |
|-------|-----|-----|
| `/` (home) | < 2.5s | < 0.1 |
| `/games` (games hub) | < 2.5s | < 0.1 |

## How to measure locally

1. Start the frontend: `npm run dev --prefix frontend`
2. Run the stub helper (prints commands): `npm run lighthouse:stub` from repo root
3. Or run Lighthouse directly:

```bash
npx lighthouse http://localhost:3000 --only-categories=performance --output=json --output-path=./lighthouse-home.json
npx lighthouse http://localhost:3000/games --only-categories=performance --output=json --output-path=./lighthouse-games.json
```

Paste **LCP** and **CLS** from each report into your PR.

## Phase 17 optimizations (implemented)

- `next/dynamic` code-splitting for Taboo play, CAH play (`CahPlay.jsx`), and NPAT play clients
- `LoadingSkeleton variant="playfield"` fallbacks while chunks load
- `React.memo` on `PlayerList`, `ScoreboardRail`, `HangmanFigure` (`TypingPassage` already memoized)
- Taboo snapshot history capped at 40 entries server-side (TD-11); dev `[taboo:snapshot]` logs in `emitRoom`
- CAH play white cards: hover lift without Framer scale (`CardPieces.jsx`)
- Shared `Button`: scale hover only on `primary` / `gradient` variants

## Future work

- Narrow `template.js` route transitions to marketing routes only
- Real Lighthouse CI (LHCI) wired in GitHub Actions
- Typing Race: split peer progress into a separate context **if** Profiler shows context churn as a hotspot (deferred in Phase 17 — see comment in `TypingRaceSocketContext.jsx`)
- Dynamic-import Framer Motion on marketing-only routes
