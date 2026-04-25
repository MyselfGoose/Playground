import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from '../../../backend/node_modules/mongoose/index.js';
import { UserStats } from '../../../backend/src/models/UserStats.js';
import { userStatsRepository } from '../../../backend/src/repositories/userStatsRepository.js';
import {
  startMongoMemoryServer,
  stopMongoMemoryServer,
  connectMongoose,
  dropAllCollections,
} from '../../support/mongoTestHarness.js';
import { applyTestEnv } from '../../support/testEnv.js';

describe('userStatsRepository (Mongo)', () => {
  before(async () => {
    await startMongoMemoryServer();
    applyTestEnv();
    await connectMongoose();
    await dropAllCollections();
  });

  after(async () => {
    await stopMongoMemoryServer();
  });

  it('leaderboard filters by minGamesField and sorts by typing_bestWpm', async () => {
    const uLow = new mongoose.Types.ObjectId();
    const uHigh = new mongoose.Types.ObjectId();

    await UserStats.create([
      {
        userId: uLow,
        username: 'slow',
        typing_totalGames: 3,
        typing_bestWpm: 40,
        typing_weightedAccuracy: 90,
      },
      {
        userId: uHigh,
        username: 'fast',
        typing_totalGames: 5,
        typing_bestWpm: 120,
        typing_weightedAccuracy: 95,
      },
    ]);

    const result = await userStatsRepository.leaderboard({
      sortField: 'typing_bestWpm',
      minGamesField: 'typing_totalGames',
      minGames: 3,
      page: 1,
      limit: 25,
    });

    assert.equal(result.total, 2);
    assert.ok(result.entries[0].typing_bestWpm >= result.entries[1].typing_bestWpm);
    assert.equal(result.entries[0].username, 'fast');
  });
});
