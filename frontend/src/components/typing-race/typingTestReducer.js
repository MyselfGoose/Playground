import {
  applyKeyEvent,
  completeTimed,
  createInitialState,
} from "../../lib/typing-test/typing-engine.js";
import { generatePassage } from "../../lib/typing-test/text-gen.js";

/**
 * @typedef {{ type: 'KEY'; event: object; ts: number }} KeyAction
 * @typedef {{ type: 'TICK'; now: number }} TickAction
 * @typedef {{ type: 'RESTART';
 *   seed: number;
 *   testMode: 'time' | 'words';
 *   timeLimitSec: number;
 *   wordTarget: number;
 *   useSentences: boolean;
 * }} RestartAction
 * @typedef {{ type: 'LOAD_SERVER_PASSAGE'; passage: string; seed: number }} LoadServerPassageAction
 * @typedef {KeyAction | TickAction | RestartAction | LoadServerPassageAction} TypingAction
 */

/**
 * @param {import('../../lib/typing-test/typing-engine.js').TypingEngineState | undefined} state
 * @param {TypingAction} action
 */
export function typingTestReducer(state, action) {
  if (!state) {
    throw new Error("typingTestReducer: no state");
  }
  switch (action.type) {
    case "KEY":
      return applyKeyEvent(state, action.event, action.ts);
    case "TICK": {
      if (state.status !== "running" || state.mode !== "time") {
        return state;
      }
      return completeTimed(state, action.now);
    }
    case "RESTART": {
      const passage = generatePassage({
        mode: action.testMode,
        seed: action.seed,
        timeLimitSec: action.timeLimitSec,
        wordTarget: action.wordTarget,
        useSentences: action.useSentences,
      });
      return createInitialState({
        mode: action.testMode,
        seed: action.seed,
        passage,
        timeLimitSec:
          action.testMode === "time" ? action.timeLimitSec : undefined,
        wordTarget:
          action.testMode === "words" ? action.wordTarget : undefined,
      });
    }
    case "LOAD_SERVER_PASSAGE": {
      const passage = action.passage;
      const wc = passage.trim().split(/\s+/).filter(Boolean).length;
      return createInitialState({
        mode: "words",
        seed: action.seed,
        passage,
        wordTarget: wc,
      });
    }
    default:
      return state;
  }
}
