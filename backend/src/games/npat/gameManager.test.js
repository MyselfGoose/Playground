import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_STATES } from './stateMachine.js';
import { NpatRoomEngine } from './gameManager.js';

const HOST_OID = '507f1f77bcf86cd799439011';
const GUEST_OID = '507f1f77bcf86cd799439012';

function makeEngine() {
  const emitted = [];
  return {
    engine: new NpatRoomEngine({
      code: 'ABCD',
      mode: 'solo',
      maxRounds: 3,
      hostUserId: HOST_OID,
      env: /** @type {any} */ ({
        NPAT_ROUND_END_COUNTDOWN_MS: 5000,
        NPAT_BETWEEN_ROUNDS_MS: 1000,
      }),
      logger: /** @type {any} */ (console),
      npatNs: /** @type {any} */ ({ to: () => ({ emit: () => {} }) }),
      persist: async () => {},
    }),
    emitted,
  };
}

test('resetForRematch moves FINISHED room to WAITING and clears ready flags', () => {
  const { engine } = makeEngine();
  engine.state = GAME_STATES.FINISHED;
  engine.players.set(HOST_OID, {
    userId: HOST_OID,
    username: 'Host',
    teamId: '',
    ready: true,
    joinedAt: Date.now(),
    socketIds: new Set(['s1']),
  });
  engine.players.set(GUEST_OID, {
    userId: GUEST_OID,
    username: 'Guest',
    teamId: '',
    ready: true,
    joinedAt: Date.now(),
    socketIds: new Set(['s2']),
  });

  engine.resetForRematch(HOST_OID);

  assert.equal(engine.state, GAME_STATES.WAITING);
  assert.equal(engine.roundPhase, 'none');
  assert.deepEqual(engine.results, { rounds: [] });
  assert.equal(engine.players.get(HOST_OID)?.ready, false);
  assert.equal(engine.players.get(GUEST_OID)?.ready, false);
});

test('resetForRematch rejects non-host', () => {
  const { engine } = makeEngine();
  engine.state = GAME_STATES.FINISHED;
  assert.throws(
    () => engine.resetForRematch(GUEST_OID),
    (err) => /** @type {any} */ (err).code === 'NOT_HOST',
  );
});
