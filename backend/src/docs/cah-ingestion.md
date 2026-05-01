# Cards Against Humanity ingestion

## Canonical dataset source

- Root dataset directory: `against-humanity-master`
- Canonical import source: `against-humanity-master/source/cards.json`
- Derived text exports:
  - `against-humanity-master/questions.txt`
  - `against-humanity-master/answers.txt`
- Important: `against-humanity-master/against-humanity-master` is a duplicate nested copy and should not be scanned recursively as an independent source.

## Baseline dataset profile

- Total cards: `1322`
- Black cards (`cardType=Q`): `275`
- White cards (`cardType=A`): `1047`
- Distinct pack values:
  - `Base`
  - `CAHe1`
  - `CAHe2`
  - `CAHe3`
  - `CAHgrognards`
  - `CAHweeaboo`
  - `CAHxmas`
  - `Image1`
  - `NEIndy`
  - `NSFH`

## Known data risks

- Duplicate text appears in a few cards (intentional in some expansions).
- Some rows contain trailing spaces in source text.
- Source includes mixed conventions (unicode punctuation, HTML entities, inline tags).

Importer behavior:

- keeps `rawText` unchanged for traceability
- stores normalized `text` for gameplay querying/rendering
- never deduplicates by text at ingest time
- enforces idempotency by `(datasetVersion, sourceId)`

## Collections and keys

- `cah_black_cards` (`CahBlackCard`)
- `cah_white_cards` (`CahWhiteCard`)

Idempotent key:

- Unique index on `{ datasetVersion: 1, sourceId: 1 }`

Gameplay query indexes:

- `pack`
- `pick` (black cards)
- `pack + pick` (black cards)

## Local import flow

From repository root:

```bash
npm run db:import:cah --prefix backend
```

Optional overrides:

```bash
CAH_DATASET_PATH=/abs/path/to/cards.json CAH_DATASET_VERSION=cah-legacy-v1 npm run db:import:cah --prefix backend
```

CLI overrides:

```bash
npm run db:import:cah --prefix backend -- --dataset "/abs/path/cards.json" --dataset-version "cah-legacy-v1"
```

## Validation checklist

1. Import completes with `skippedInvalid: 0` for the canonical dataset.
2. DB counts for chosen `datasetVersion`:
   - black cards: `275`
   - white cards: `1047`
3. Pack coverage in both collections includes all expected expansion values.
4. Re-run import with same dataset/version:
   - totals remain stable
   - no duplicate records are created.

## Future gameplay readiness

- Black prompts can be sampled by `pick` and optional `pack`.
- White answers can be sampled by optional `pack`.
- Room-level anti-repeat can track used `sourceId` values while querying from these collections.

### Suggested query patterns for future game services

- Random black prompt by pick:
  - `CahBlackCard.aggregate([{ $match: { datasetVersion, pick } }, { $sample: { size: 1 } }])`
- Random black prompt by pick + pack:
  - `CahBlackCard.aggregate([{ $match: { datasetVersion, pick, pack } }, { $sample: { size: 1 } }])`
- Random white draw by pack with anti-repeat:
  - `CahWhiteCard.aggregate([{ $match: { datasetVersion, pack, sourceId: { $nin: usedSourceIds } } }, { $sample: { size: handSize } }])`
- Fallback if filtered pool is exhausted:
  - widen filter (drop pack constraint) before reusing already-used cards.

### Anti-repeat strategy (to implement later in game state manager)

Maintain per-room state:

- `usedBlackSourceIds: Set<number>`
- `usedWhiteSourceIdsByPlayer: Map<userId, Set<number>>`

Flow for each draw:

1. Query with `$nin` against used IDs.
2. Add drawn `sourceId` to room used sets.
3. Reset used sets when deck exhaustion threshold is reached or a new match starts.
