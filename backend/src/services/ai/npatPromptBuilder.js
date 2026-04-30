const NPAT_SYSTEM_PROMPT = `You are an NPAT (Name, Place, Animal, Thing) evaluation service.
Return JSON ONLY. No markdown, no prose, no code fences.

Rules:
- Answers are trimmed.
- A valid answer must start with the round letter.
- Empty answer is invalid.
- Duplicate means exact normalized match (trim/lowercase/collapse spaces) in the same round and category.
- Categories: name, place, animal, thing.
- Score by flags only:
  - valid and unique: 10
  - valid and duplicate: 5
  - invalid: 0

Output must use this exact shape:
{
  "rounds": [
    {
      "roundIndex": 0,
      "round": "A",
      "results": [
        {
          "playerId": "string",
          "playerName": "string",
          "answers": {
            "name": { "value": "", "isValid": false, "isDuplicate": false, "score": 0, "comment": "" },
            "place": { "value": "", "isValid": false, "isDuplicate": false, "score": 0, "comment": "" },
            "animal": { "value": "", "isValid": false, "isDuplicate": false, "score": 0, "comment": "" },
            "thing": { "value": "", "isValid": false, "isDuplicate": false, "score": 0, "comment": "" }
          },
          "totalScore": 0
        }
      ]
    }
  ]
}

Requirements:
- Include every round from INPUT_JSON exactly once.
- Include every player in each round exactly once.
- Keep playerId and playerName unchanged.
- Keep comment short and specific.`;

function cap(value, max) {
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max) : text;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * @param {import('../../config/env.js').Env} env
 * @param {{ language?: string, rounds: Array<{ roundIndex: number, roundLetter: string, players: Array<{ playerId: string, playerName: string, answers: Record<string, string> }> }> }} input
 */
export function buildNpatCanonicalPrompt(env, input) {
  const normalized = {
    language: String(input.language ?? 'en').toLowerCase(),
    rounds: [...input.rounds]
      .sort((a, b) => a.roundIndex - b.roundIndex)
      .map((round) => ({
        roundIndex: round.roundIndex,
        roundLetter: String(round.roundLetter ?? '?').trim().toUpperCase().slice(0, 1),
        players: [...round.players]
          .sort((a, b) => String(a.playerId).localeCompare(String(b.playerId)))
          .map((player) => ({
            playerId: String(player.playerId),
            playerName: String(player.playerName ?? ''),
            answers: {
              name: cap(player.answers?.name, env.NPAT_EVAL_MAX_ANSWER_CHARS),
              place: cap(player.answers?.place, env.NPAT_EVAL_MAX_ANSWER_CHARS),
              animal: cap(player.answers?.animal, env.NPAT_EVAL_MAX_ANSWER_CHARS),
              thing: cap(player.answers?.thing, env.NPAT_EVAL_MAX_ANSWER_CHARS),
            },
          })),
      })),
  };
  return `${NPAT_SYSTEM_PROMPT}\n\nINPUT_JSON:\n${stableStringify(normalized)}`;
}
