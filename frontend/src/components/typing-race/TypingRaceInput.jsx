"use client";

/**
 * Hidden textarea used for solo and multiplayer typing capture.
 *
 * @param {{
 *   inputRef: import('react').RefObject<HTMLTextAreaElement | null>;
 *   bindInputFocus?: () => { onFocus?: () => void; onBlur?: () => void };
 *   isComposing: boolean;
 *   setIsComposing: (v: boolean) => void;
 *   onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
 * }} props
 */
export function TypingRaceInput({
  inputRef,
  bindInputFocus,
  isComposing,
  setIsComposing,
  onKeyDown,
}) {
  const focusHandlers = bindInputFocus?.() ?? {};

  return (
    <textarea
      ref={inputRef}
      aria-label="Typing input"
      className="typing-hidden-input"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      rows={1}
      onInput={(e) => {
        e.currentTarget.value = "";
      }}
      onPaste={(e) => e.preventDefault()}
      onCompositionStart={() => setIsComposing(true)}
      onCompositionEnd={() => setIsComposing(false)}
      onFocus={focusHandlers.onFocus}
      onBlur={focusHandlers.onBlur}
      onKeyDown={onKeyDown}
    />
  );
}
