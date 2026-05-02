export const HANGMAN_ROOM_CODE_LENGTH = 4;
export const HANGMAN_MIN_PLAYERS = 2;
export const HANGMAN_WORD_MIN = 4;
export const HANGMAN_WORD_MAX = 24;
export const HANGMAN_DEFAULT_MAX_WRONG = 7;
/** Points awarded to the first player to guess a correct letter each round. */
export const HANGMAN_POINTS_LETTER_FIRST = 10;
/** Setter bonus when guessers complete the word before hangman fills. */
export const HANGMAN_POINTS_SETTER_COMPLETE = 15;
/** Split among non-setters who had at least one first-letter hit when efficiency threshold met. */
export const HANGMAN_POINTS_EFFICIENCY_POOL = 12;
