/**
 * Build a keyboard event payload for the typing engine reducer.
 * @param {KeyboardEvent | React.KeyboardEvent} e
 */
export function typingKeyEventFromDom(e) {
  return {
    key: e.key,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
  };
}

/**
 * Solo test: Tab / Enter restart + KEY dispatch.
 * @param {{
 *   engine: { status: string };
 *   isComposing: boolean;
 *   tabArmed: boolean;
 *   setTabArmed: (v: boolean) => void;
 *   restart: () => void;
 *   dispatch: (action: { type: 'KEY'; event: object; ts: number }) => void;
 * }} ctx
 * @param {KeyboardEvent | React.KeyboardEvent} e
 */
export function handleSoloTypingKeyDown(ctx, e) {
  const { engine, isComposing, tabArmed, setTabArmed, restart, dispatch } = ctx;
  if (isComposing) {
    return;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    if (engine.status === "completed" || engine.status === "idle") {
      restart();
      return;
    }
    setTabArmed(true);
    return;
  }
  if (e.key === "Enter") {
    if (tabArmed) {
      e.preventDefault();
      restart();
      setTabArmed(false);
      return;
    }
    if (engine.status === "completed") {
      e.preventDefault();
      restart();
    }
  }
  if (engine.status === "completed") {
    return;
  }
  dispatch({
    type: "KEY",
    event: typingKeyEventFromDom(e),
    ts: e.timeStamp || performance.now(),
  });
  if (e.key !== "Backspace") {
    setTabArmed(false);
  }
}

/**
 * Multiplayer race: KEY dispatch only.
 * @param {{
 *   isComposing: boolean;
 *   dispatch: (action: { type: 'KEY'; event: object; ts: number }) => void;
 * }} ctx
 * @param {KeyboardEvent | React.KeyboardEvent} e
 */
export function handleRaceTypingKeyDown(ctx, e) {
  const { isComposing, dispatch } = ctx;
  if (isComposing) {
    return;
  }
  if (e.key === "Tab" || e.key === "Enter") {
    e.preventDefault();
    return;
  }
  dispatch({
    type: "KEY",
    event: typingKeyEventFromDom(e),
    ts: e.timeStamp || performance.now(),
  });
}
