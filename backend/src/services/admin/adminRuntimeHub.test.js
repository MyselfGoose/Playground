import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerGameAdminAdapter,
  listAllRoomsForAdmin,
  adminForceCloseRoom,
  clearAdminRuntimeHubForTests,
} from './adminRuntimeHub.js';

describe('adminRuntimeHub', () => {
  beforeEach(() => {
    clearAdminRuntimeHubForTests();
  });

  it('lists rooms from registered adapters', () => {
    registerGameAdminAdapter({
      game: 'test-game',
      listRooms: () => [{ code: 'ABC', game: 'test-game', playerCount: 2 }],
      getRoom: () => null,
      forceClose: () => ({ ok: true, code: 'ABC' }),
      kickPlayer: () => ({ ok: true }),
    });
    const rows = listAllRoomsForAdmin();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].code, 'ABC');
  });

  it('force closes via adapter', () => {
    let closed = false;
    registerGameAdminAdapter({
      game: 'test-game',
      listRooms: () => [],
      getRoom: () => null,
      forceClose: (code) => {
        closed = true;
        return { ok: true, code };
      },
      kickPlayer: () => ({ ok: true }),
    });
    const res = adminForceCloseRoom('test-game', 'XYZ');
    assert.equal(closed, true);
    assert.equal(res.code, 'XYZ');
  });
});
