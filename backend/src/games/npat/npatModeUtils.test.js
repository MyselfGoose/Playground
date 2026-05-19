import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNpatMode,
  isFreeForAllMode,
  resolveGameEvaluationSource,
  NPAT_MODE_FREE_FOR_ALL,
  NPAT_MODE_TEAM,
} from './npatModeUtils.js';

describe('npatModeUtils', () => {
  describe('normalizeNpatMode', () => {
    it('maps legacy solo to free-for-all', () => {
      assert.equal(normalizeNpatMode('solo'), NPAT_MODE_FREE_FOR_ALL);
    });

    it('preserves team mode', () => {
      assert.equal(normalizeNpatMode('team'), NPAT_MODE_TEAM);
    });

    it('defaults unknown to free-for-all', () => {
      assert.equal(normalizeNpatMode(undefined), NPAT_MODE_FREE_FOR_ALL);
    });
  });

  describe('isFreeForAllMode', () => {
    it('returns true for solo alias and canonical key', () => {
      assert.equal(isFreeForAllMode('solo'), true);
      assert.equal(isFreeForAllMode('free-for-all'), true);
    });

    it('returns false for team', () => {
      assert.equal(isFreeForAllMode('team'), false);
    });
  });

  describe('resolveGameEvaluationSource', () => {
    it('prefers gemini when any round used AI', () => {
      assert.equal(
        resolveGameEvaluationSource({
          rounds: [
            { evaluationSource: 'fallback' },
            { evaluationSource: 'gemini' },
          ],
        }),
        'gemini',
      );
    });

    it('returns fallback when no gemini rounds', () => {
      assert.equal(
        resolveGameEvaluationSource({
          rounds: [{ evaluationSource: 'fallback' }],
        }),
        'fallback',
      );
    });

    it('returns null when no rounds scored', () => {
      assert.equal(resolveGameEvaluationSource({ rounds: [] }), null);
      assert.equal(resolveGameEvaluationSource(null), null);
    });
  });
});
