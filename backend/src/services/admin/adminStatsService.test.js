import { test } from 'node:test';
import assert from 'node:assert/strict';

test('admin stats patch rejects unknown fields', async () => {
  const { adminStatsService } = await import('./adminStatsService.js');
  await assert.rejects(
    () => adminStatsService.patchStats('507f1f77bcf86cd799439011', { not_a_real_field: 1 }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    },
  );
});

test('admin stats rejects invalid user id', async () => {
  const { adminStatsService } = await import('./adminStatsService.js');
  await assert.rejects(
    () => adminStatsService.patchStats('not-an-id', { typing_totalGames: 1 }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    },
  );
});
