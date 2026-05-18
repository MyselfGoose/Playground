export const HANGMAN_ROOM_CODE_LENGTH = 4;
export const HANGMAN_MIN_PLAYERS = 2;
export const HANGMAN_WORD_MIN = 4;
export const HANGMAN_WORD_MAX = 24;
/** Universal Hangman rule: six wrong guesses before loss. */
export const HANGMAN_MAX_WRONG = 6;
export const HANGMAN_LOBBY_COUNTDOWN_MS = 5000;
export const HANGMAN_TURN_TIMEOUT_MS = 25_000;
/** Auto-pick a random word if setter does not submit in time (setter_pick phase). */
export const HANGMAN_SETTER_PICK_TIMEOUT_MS = 90_000;
/** Points per correct letter guess on your turn. */
export const HANGMAN_POINTS_LETTER_CORRECT = 10;
/** Setter bonus when guessers complete the word before hangman fills. */
export const HANGMAN_POINTS_SETTER_COMPLETE = 15;
/** Split among non-setters who guessed at least one correct letter when efficiency threshold met. */
export const HANGMAN_POINTS_EFFICIENCY_POOL = 12;
