export const GAME_STATES = {
  WAITING: 'WAITING',
  STARTING: 'STARTING',
  IN_ROUND: 'IN_ROUND',
  ROUND_ENDING: 'ROUND_ENDING',
  BETWEEN_ROUNDS: 'BETWEEN_ROUNDS',
  FINISHED: 'FINISHED',
};

/** @typedef {keyof typeof GAME_STATES} GameState */

/**
 * @param {string} from
 * @param {string} to
 * @param {{ roundPhase?: string }} [ctx]
 */
export function canTransition(from, to, ctx = {}) {
  if (from === to) {
    return true;
  }
  const rp = ctx.roundPhase ?? 'none';
  switch (from) {
    case GAME_STATES.WAITING:
      return to === GAME_STATES.STARTING;
    case GAME_STATES.STARTING:
      return to === GAME_STATES.IN_ROUND;
    case GAME_STATES.IN_ROUND:
      if (to === GAME_STATES.IN_ROUND && (rp === 'collecting' || rp === 'countdown')) {
        return true;
      }
      return to === GAME_STATES.ROUND_ENDING || to === GAME_STATES.FINISHED;
    case GAME_STATES.ROUND_ENDING:
      return to === GAME_STATES.BETWEEN_ROUNDS || to === GAME_STATES.FINISHED;
    case GAME_STATES.BETWEEN_ROUNDS:
      return to === GAME_STATES.IN_ROUND || to === GAME_STATES.FINISHED;
    case GAME_STATES.FINISHED:
      return false;
    default:
      return false;
  }
}

/**
 * @param {string} from
 * @param {string} to
 * @param {{ roundPhase?: string }} [ctx]
 */
export function assertTransition(from, to, ctx) {
  if (!canTransition(from, to, ctx)) {
    throw new Error(`Invalid NPAT transition ${from} -> ${to} (roundPhase=${ctx?.roundPhase})`);
  }
}
