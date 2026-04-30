import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildNpatCanonicalPrompt } from './ai/npatPromptBuilder.js';

const env = {
  NPAT_EVAL_MAX_ANSWER_CHARS: 8,
};

describe('npatPromptBuilder', () => {
  it('builds deterministic prompt regardless of input ordering', () => {
    const inputA = {
      language: 'EN',
      rounds: [
        {
          roundIndex: 1,
          roundLetter: 'b',
          players: [
            {
              playerId: 'u2',
              playerName: 'Ben',
              answers: { name: 'bob', place: 'berlin', animal: 'bear', thing: 'book' },
            },
            {
              playerId: 'u1',
              playerName: 'Amy',
              answers: { name: 'amy', place: 'athens', animal: 'ant', thing: 'arrow' },
            },
          ],
        },
      ],
    };
    const inputB = {
      language: 'en',
      rounds: [
        {
          roundIndex: 1,
          roundLetter: 'B',
          players: [...inputA.rounds[0].players].reverse(),
        },
      ],
    };

    const promptA = buildNpatCanonicalPrompt(env, inputA);
    const promptB = buildNpatCanonicalPrompt(env, inputB);
    assert.equal(promptA, promptB);
  });

  it('truncates long answers to configured max length', () => {
    const input = {
      language: 'en',
      rounds: [
        {
          roundIndex: 0,
          roundLetter: 'A',
          players: [
            {
              playerId: 'u1',
              playerName: 'Alice',
              answers: {
                name: 'A'.repeat(20),
                place: 'Athens',
                animal: 'Antelope',
                thing: 'Arrow',
              },
            },
          ],
        },
      ],
    };
    const prompt = buildNpatCanonicalPrompt(env, input);
    assert.ok(prompt.includes('"name":"AAAAAAAA"'));
    assert.ok(!prompt.includes('"name":"AAAAAAAAA"'));
  });
});
