/** @typedef {{ id: string; title: string; description: string; emoji: string; accent: string }} Game */

/** @type {Game[]} */
export const GAMES = [
  {
    id: "typing-race",
    title: "Typing Race",
    description: "Race the clock and your friends in a blur of keys.",
    emoji: "⌨️",
    accent: "lavender",
  },
  {
    id: "name-place-animal-thing",
    title: "Name Place Animal Thing",
    description: "Fill the grid before time runs out — silly answers welcome.",
    emoji: "🌍",
    accent: "mint",
  },
  {
    id: "trivia",
    title: "Trivia Game",
    description: "Brainy vibes, buzzer energy, and surprise categories.",
    emoji: "🧠",
    accent: "peach",
  },
  {
    id: "mcq-challenge",
    title: "MCQ Challenge",
    description: "Quick picks, tricky distractors, instant bragging rights.",
    emoji: "✅",
    accent: "sky",
  },
  {
    id: "hangman",
    title: "Hangman",
    description: "Classic letters-and-guesses with a soft pastel twist.",
    emoji: "🪢",
    accent: "butter",
  },
];
