/**
 * Build the payload sent to Gemini / fallback from a closed round snapshot.
 *
 * @param {{
 *   results: { rounds: Array<{ roundIndex: number, letter?: string, submissions?: Record<string, Record<string, string>> }> },
 *   players: Map<string, { username?: string }>,
 * }} engine
 * @param {number} roundIndex
 */
export function buildNpatEvaluationInput(engine, roundIndex) {
  const round = engine.results.rounds.find((r) => r.roundIndex === roundIndex);
  if (!round) {
    throw new Error(`Round ${roundIndex} not found in engine results`);
  }
  const letter = String(round.letter ?? '?').toUpperCase().slice(0, 1);
  const subs = round.submissions && typeof round.submissions === 'object' ? round.submissions : {};
  const players = [];
  const orderedPlayerIds = [...engine.players.keys()].sort();
  for (const playerId of orderedPlayerIds) {
    const p = engine.players.get(playerId);
    const row = subs[playerId] ?? {};
    players.push({
      playerId,
      playerName: p?.username ?? 'Player',
      answers: {
        name: row?.name ?? '',
        place: row?.place ?? '',
        animal: row?.animal ?? '',
        thing: row?.thing ?? '',
      },
    });
  }
  return { roundLetter: letter, language: 'en', players };
}

/**
 * All completed rounds for end-of-game batch scoring.
 *
 * @param {{
 *   results: { rounds: Array<{ roundIndex: number }> },
 *   players: Map<string, { username?: string }>,
 * }} engine
 */
export function buildNpatFullGameEvaluationInput(engine) {
  const rounds = [];
  const orderedRounds = [...engine.results.rounds].sort((a, b) => a.roundIndex - b.roundIndex);
  for (const r of orderedRounds) {
    const one = buildNpatEvaluationInput(engine, r.roundIndex);
    rounds.push({
      roundIndex: r.roundIndex,
      roundLetter: one.roundLetter,
      players: one.players,
    });
  }
  return { language: 'en', rounds };
}
