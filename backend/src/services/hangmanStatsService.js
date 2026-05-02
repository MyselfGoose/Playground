import { hangmanGameResultRepository } from '../repositories/hangmanGameResultRepository.js';
import { hangmanRoundResultRepository } from '../repositories/hangmanRoundResultRepository.js';
import { userStatsRepository } from '../repositories/userStatsRepository.js';

function isDuplicateKey(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

/**
 * @param {import('pino').Logger | undefined} log
 */
export async function persistHangmanGameResult(payload, log) {
  try {
    await hangmanGameResultRepository.insertOne(payload);
  } catch (err) {
    if (!isDuplicateKey(err)) {
      log?.warn({ err, event: 'hangman_result_persist_failed' }, 'hangman');
    }
  }

  try {
    await userStatsRepository.recordHangmanGameResult({
      userId: payload.userId,
      username: payload.username,
      won: Boolean(payload.won),
      correctGuesses: Number(payload.correctGuesses ?? 0),
      wrongGuesses: Number(payload.wrongGuesses ?? 0),
      totalGuesses: Number(payload.totalGuesses ?? Number(payload.correctGuesses ?? 0) + Number(payload.wrongGuesses ?? 0)),
      fastFinish: Boolean(payload.fastFinish),
      modeWeight: Number(payload.modeWeight ?? 1),
    });
  } catch (err) {
    log?.warn({ err, event: 'hangman_stats_update_failed' }, 'hangman');
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @param {import('pino').Logger | undefined} log
 */
export async function persistHangmanRoundResult(payload, log) {
  try {
    await hangmanRoundResultRepository.insertOne(payload);
  } catch (err) {
    if (!isDuplicateKey(err)) {
      log?.warn({ err, event: 'hangman_round_persist_failed' }, 'hangman');
    }
  }
}
