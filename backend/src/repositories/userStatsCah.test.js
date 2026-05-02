import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCahDerived, computeGlobalScore, computeHangmanDerived } from './userStatsRepository.js';

test('computeCahDerived handles zeros', () => {
  const d = computeCahDerived({
    cah_gamesPlayed: 0,
    cah_roundsPlayed: 0,
    cah_roundWins: 0,
  });
  assert.equal(d.cah_winRate, 0);
  assert.equal(d.cah_avgRoundWinsPerGame, 0);
  assert.equal(d.cah_score, 0);
});

test('computeCahDerived reflects wins and volume', () => {
  const d = computeCahDerived({
    cah_gamesPlayed: 10,
    cah_roundsPlayed: 40,
    cah_roundWins: 20,
  });
  assert.ok(d.cah_winRate > 0);
  assert.ok(d.cah_avgRoundWinsPerGame > 0);
  assert.ok(d.cah_score > 25 && d.cah_score <= 100);
});

test('computeGlobalScore includes CAH component and totals activity games', () => {
  const base = {
    typing_bestWpm: 0,
    typing_weightedAccuracy: 0,
    npat_averageScore: 0,
    taboo_score: 0,
    cah_score: 0,
    typing_totalGames: 0,
    npat_totalGames: 0,
    taboo_gamesPlayed: 0,
    cah_gamesPlayed: 0,
    activeDaysLast30: 0,
  };
  const low = computeGlobalScore(base);
  const high = computeGlobalScore({ ...base, cah_score: 100 });
  assert.ok(high > low);

  const act = computeGlobalScore({ ...base, cah_gamesPlayed: 50 });
  assert.ok(act > low);
});

test('computeHangmanDerived applies shrinkage and bounded skill', () => {
  const sparse = computeHangmanDerived({
    hangman_totalGames: 1,
    hangman_totalWins: 1,
    hangman_correctGuesses: 1,
    hangman_wrongGuesses: 0,
    hangman_totalGuesses: 1,
    hangman_activeDaysLast30: 1,
    hangman_fastFinishes: 1,
  });
  const mature = computeHangmanDerived({
    hangman_totalGames: 30,
    hangman_totalWins: 21,
    hangman_correctGuesses: 200,
    hangman_wrongGuesses: 40,
    hangman_totalGuesses: 240,
    hangman_activeDaysLast30: 12,
    hangman_fastFinishes: 8,
  });
  assert.ok(sparse.hangman_skill <= 100 && sparse.hangman_skill >= 0);
  assert.ok(mature.hangman_skill <= 100 && mature.hangman_skill >= 0);
  assert.ok(mature.hangman_skill > sparse.hangman_skill);
});

test('computeGlobalScore includes hangman contribution', () => {
  const base = {
    typing_bestWpm: 0,
    typing_weightedAccuracy: 0,
    npat_averageScore: 0,
    taboo_score: 0,
    cah_score: 0,
    hangman_skill: 0,
    typing_totalGames: 0,
    npat_totalGames: 0,
    taboo_gamesPlayed: 0,
    cah_gamesPlayed: 0,
    hangman_totalGames: 0,
    activeDaysLast30: 0,
  };
  const low = computeGlobalScore(base);
  const high = computeGlobalScore({ ...base, hangman_skill: 100 });
  assert.ok(high > low);
});
