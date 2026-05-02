import { hangmanGameResultRepository } from '../repositories/hangmanGameResultRepository.js';

function persistEnabled() {
  return String(process.env.HANGMAN_PERSIST_STATS ?? '').toLowerCase() === 'true';
}

/**
 * Stub hook for future leaderboard wiring. No-op unless `HANGMAN_PERSIST_STATS=true`.
 * @param {import('pino').Logger | undefined} log
 */
export async function persistHangmanGameResult(payload, log) {
  if (!persistEnabled()) return;
  try {
    await hangmanGameResultRepository.insertOne(payload);
  } catch (err) {
    log?.warn({ err, event: 'hangman_result_persist_failed' }, 'hangman');
  }
}
