import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapTypingAttemptToMatch,
  mapNpatResultToMatch,
  mergeAndSortMatches,
} from './matchHistoryService.js';

describe('mapTypingAttemptToMatch', () => {
  it('maps rank and room code', () => {
    const row = mapTypingAttemptToMatch({
      mode: 'multi',
      rank: 2,
      roomCode: '123456',
      wpm: 88,
      accuracy: 97,
      playerCount: 4,
      finishedAt: new Date('2026-01-15T12:00:00.000Z'),
    });
    assert.equal(row.game, 'typing-race');
    assert.equal(row.placement, 2);
    assert.equal(row.roomCode, '123456');
    assert.equal(row.summary.wpm, 88);
  });
});

describe('mapNpatResultToMatch', () => {
  it('placement 1 for win', () => {
    const row = mapNpatResultToMatch({
      outcome: 'win',
      roomCode: 'ABCD',
      totalScore: 120,
      averageScore: 30,
      mode: 'team',
      playerCount: 4,
      finishedAt: '2026-01-10T08:00:00.000Z',
    });
    assert.equal(row.placement, 1);
    assert.equal(row.game, 'npat');
  });

  it('null placement for loss', () => {
    const row = mapNpatResultToMatch({
      outcome: 'loss',
      roomCode: 'ABCD',
      finishedAt: '2026-01-10T08:00:00.000Z',
    });
    assert.equal(row.placement, null);
  });
});

describe('mergeAndSortMatches', () => {
  it('sorts by finishedAt desc and caps limit', () => {
    const merged = mergeAndSortMatches(
      [
        { finishedAt: '2026-01-01T00:00:00.000Z', game: 'npat' },
        { finishedAt: '2026-01-03T00:00:00.000Z', game: 'typing-race' },
        { finishedAt: '2026-01-02T00:00:00.000Z', game: 'npat' },
      ],
      2,
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].game, 'typing-race');
    assert.equal(merged[1].game, 'npat');
  });
});
