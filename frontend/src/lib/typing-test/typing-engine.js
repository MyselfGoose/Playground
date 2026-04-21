/**
 * Pure typing engine — cursor + errorStack model (Monkeytype-like).
 * Serializable for future multiplayer replay.
 */

export const DEFAULT_STATS = Object.freeze({
  correctChars: 0,
  incorrectChars: 0,
  extraChars: 0,
});

/**
 * @typedef {'idle' | 'running' | 'completed'} TestStatus
 * @typedef {{
 *   mode: 'time' | 'words';
 *   seed: number;
 *   passage: string;
 *   timeLimitSec?: number;
 *   wordTarget?: number;
 *   cursor: number;
 *   errorStack: string;
 *   stats: typeof DEFAULT_STATS;
 *   status: TestStatus;
 *   startedAtMs?: number;
 *   completedAtMs?: number;
 * }} TypingEngineState
 */

/**
 * @param {Partial<TypingEngineState> & Pick<TypingEngineState, 'mode'|'seed'|'passage'>} opts
 * @returns {TypingEngineState}
 */
export function createInitialState(opts) {
  return {
    mode: opts.mode,
    seed: opts.seed,
    passage: opts.passage,
    timeLimitSec: opts.timeLimitSec,
    wordTarget: opts.wordTarget,
    cursor: 0,
    errorStack: "",
    stats: { ...DEFAULT_STATS },
    status: "idle",
    startedAtMs: undefined,
    completedAtMs: undefined,
  };
}

/**
 * @param {TypingEngineState} s
 * @param {string} more — appended with a leading space if passage non-empty
 */
export function appendPassage(s, more) {
  if (!more) return s;
  const spacer = s.passage.length && !s.passage.endsWith(" ") ? " " : "";
  return { ...s, passage: s.passage + spacer + more };
}

/**
 * @param {object} e — browser KeyboardEvent-like
 * @param {string} e.key
 * @param {string} [e.code]
 * @param {boolean} [e.ctrlKey]
 * @param {boolean} [e.metaKey]
 * @param {boolean} [e.altKey]
 */
export function applyKeyEvent(state, e, timestampMs) {
  if (state.status === "completed") {
    return state;
  }

  if (e.ctrlKey || e.metaKey || e.altKey) {
    return state;
  }

  /** Tab / Enter reserved for restart in UI — ignore in engine */
  if (e.key === "Tab" || e.key === "Enter") {
    return state;
  }

  if (state.status === "running" && state.mode === "time" && state.timeLimitSec != null) {
    const start = state.startedAtMs;
    if (start != null && timestampMs - start >= state.timeLimitSec * 1000) {
      return finishState(state, timestampMs);
    }
  }

  if (e.key === "Backspace") {
    return applyBackspace(state, timestampMs);
  }

  const ch = keyToChar(e);
  if (ch === null) {
    return state;
  }

  if (state.status === "idle") {
    const next = {
      ...state,
      status: "running",
      startedAtMs: timestampMs,
    };
    return applyPrintable(next, ch, timestampMs);
  }

  if (state.status !== "running") {
    return state;
  }

  if (state.mode === "time" && state.timeLimitSec != null && state.startedAtMs != null) {
    if (timestampMs - state.startedAtMs >= state.timeLimitSec * 1000) {
      return finishState(state, timestampMs);
    }
  }

  return applyPrintable(state, ch, timestampMs);
}

/**
 * @param {object} e
 * @returns {string | null}
 */
function keyToChar(e) {
  const k = e.key;
  if (k.length === 1) {
    return k;
  }
  return null;
}

/**
 * @param {TypingEngineState} state
 * @param {number} timestampMs
 */
function applyBackspace(state, timestampMs) {
  if (state.errorStack.length > 0) {
    return {
      ...state,
      errorStack: state.errorStack.slice(0, -1),
    };
  }
  if (state.cursor <= 0) {
    return state;
  }
  const next = {
    ...state,
    cursor: state.cursor - 1,
    stats: {
      ...state.stats,
      correctChars: Math.max(0, state.stats.correctChars - 1),
    },
  };
  if (next.mode === "words") {
    return tryCompleteWordsMode(next, timestampMs);
  }
  return next;
}

/**
 * @param {TypingEngineState} state
 * @param {string} ch
 * @param {number} timestampMs
 */
function applyPrintable(state, ch, timestampMs) {
  if (state.errorStack.length > 0) {
    return {
      ...state,
      errorStack: state.errorStack + ch,
      stats: {
        ...state.stats,
        incorrectChars: state.stats.incorrectChars + 1,
      },
    };
  }

  if (state.cursor < state.passage.length) {
    const expected = state.passage[state.cursor];
    if (ch === expected) {
      const next = {
        ...state,
        cursor: state.cursor + 1,
        stats: {
          ...state.stats,
          correctChars: state.stats.correctChars + 1,
        },
      };
      return tryCompleteWordsMode(next, timestampMs);
    }
    return {
      ...state,
      errorStack: ch,
      stats: {
        ...state.stats,
        incorrectChars: state.stats.incorrectChars + 1,
      },
    };
  }

  /** Past end of passage */
  return {
    ...state,
    stats: {
      ...state.stats,
      extraChars: state.stats.extraChars + 1,
    },
  };
}

/**
 * @param {TypingEngineState} state
 * @param {number} atMs
 */
function tryCompleteWordsMode(state, atMs) {
  if (state.mode !== "words") {
    return state;
  }
  if (state.errorStack.length > 0) {
    return state;
  }
  if (state.cursor < state.passage.length) {
    return state;
  }
  return finishState(state, atMs);
}

/**
 * @param {TypingEngineState} state
 * @param {number} atMs
 */
function finishState(state, atMs) {
  if (state.status === "completed") {
    return state;
  }
  return {
    ...state,
    status: "completed",
    completedAtMs: atMs,
  };
}

/**
 * Complete when wall-clock passes time limit (performance.now()-compatible stamps).
 * @param {TypingEngineState} state
 * @param {number} atMs
 */
export function completeTimed(state, atMs) {
  if (state.status !== "running" || state.mode !== "time") {
    return state;
  }
  if (state.timeLimitSec == null || state.startedAtMs == null) {
    return state;
  }
  if (atMs - state.startedAtMs < state.timeLimitSec * 1000) {
    return state;
  }
  return finishState(state, atMs);
}

/**
 * Display column index (for caret / highlighting).
 * @param {TypingEngineState} s
 */
export function getDisplayIndex(s) {
  return s.cursor + s.errorStack.length;
}
