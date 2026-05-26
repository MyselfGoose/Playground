import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

/**
 * Test-only: return a fake model from `createNpatGenerativeModel` (integration tests).
 * Must be cleared after each suite so production code paths are not affected.
 * @type {null | ((params: NpatGenerativeModelParams) => unknown)}
 */
let createNpatGenerativeModelOverride = null;

/**
 * @typedef {{
 *   apiKey: string,
 *   modelId: string,
 *   maxOutputTokens: number,
 *   geminiMockMode?: boolean,
 * }} NpatGenerativeModelParams
 */

/** @param {typeof createNpatGenerativeModelOverride} fn */
export function setNpatGenerativeModelOverrideForTests(fn) {
  createNpatGenerativeModelOverride = fn;
}

export function clearNpatGenerativeModelOverrideForTests() {
  createNpatGenerativeModelOverride = null;
}

export function createDeterministicGeminiMockResponse() {
  return JSON.stringify({
    rounds: [
      {
        roundIndex: 0,
        round: 'A',
        results: [
          {
            playerId: 'mock-player',
            playerName: 'Mock Player',
            answers: {
              name: { value: 'Amy', isValid: true, isDuplicate: false, score: 10, comment: 'Valid name for A.' },
              place: { value: 'Athens', isValid: true, isDuplicate: false, score: 10, comment: 'Valid place for A.' },
              animal: { value: 'Ant', isValid: true, isDuplicate: false, score: 10, comment: 'Valid animal for A.' },
              thing: { value: 'Arrow', isValid: true, isDuplicate: false, score: 10, comment: 'Valid thing for A.' },
            },
            totalScore: 40,
          },
        ],
      },
    ],
  });
}

/**
 * Gemini model configured for NPAT judging: JSON output, room for long batch
 * responses, and permissive safety (user-submitted words/places must be scored).
 *
 * @param {NpatGenerativeModelParams} params
 */
export function createNpatGenerativeModel(params) {
  if (createNpatGenerativeModelOverride) {
    return createNpatGenerativeModelOverride(params);
  }
  if (params.geminiMockMode) {
    return {
      generateContent: async () => ({
        response: {
          text: () => createDeterministicGeminiMockResponse(),
        },
      }),
    };
  }
  const genAI = new GoogleGenerativeAI(params.apiKey);
  return genAI.getGenerativeModel({
    model: params.modelId,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: params.maxOutputTokens,
      temperature: 0.2,
    },
  });
}
