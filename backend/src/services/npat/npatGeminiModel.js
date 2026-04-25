import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

/**
 * Test-only: return a fake model from `createNpatGenerativeModel` (integration tests).
 * Must be cleared after each suite so production code paths are not affected.
 * @type {null | ((env: import('../../config/env.js').Env) => unknown)}
 */
let createNpatGenerativeModelOverride = null;

/** @param {typeof createNpatGenerativeModelOverride} fn */
export function setNpatGenerativeModelOverrideForTests(fn) {
  createNpatGenerativeModelOverride = fn;
}

export function clearNpatGenerativeModelOverrideForTests() {
  createNpatGenerativeModelOverride = null;
}

/**
 * Gemini model configured for NPAT judging: JSON output, room for long batch
 * responses, and permissive safety (user-submitted words/places must be scored).
 *
 * @param {import('../../config/env.js').Env} env
 */
export function createNpatGenerativeModel(env) {
  if (createNpatGenerativeModelOverride) {
    return createNpatGenerativeModelOverride(env);
  }
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: env.NPAT_EVAL_MAX_OUTPUT_TOKENS,
      temperature: 0.2,
    },
  });
}
