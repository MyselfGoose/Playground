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
    id: "taboo",
    title: "Taboo",
    description: "Give clues fast, dodge taboo words, and win the round.",
    emoji: "🎯",
    accent: "peach",
  },
  {
    id: "cards-against-humanity",
    title: "Cards Against Humanity",
    description: "Fill the blank, judge the chaos, and laugh your way to victory.",
    emoji: "🃏",
    accent: "lavender",
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

/** @type {readonly string[]} */
export const PLAYABLE_GAME_IDS = [
  "name-place-animal-thing",
  "typing-race",
  "taboo",
  "cards-against-humanity",
  "hangman",
];

/**
 * @param {string} gameId
 * @returns {Game | undefined}
 */
export function getGameById(gameId) {
  return GAMES.find((g) => g.id === gameId);
}

/** @returns {Game[]} */
export function getPlayableGames() {
  return GAMES.filter((g) => PLAYABLE_GAME_IDS.includes(g.id));
}

/** @returns {Game[]} */
export function getComingSoonGames() {
  return GAMES.filter((g) => !PLAYABLE_GAME_IDS.includes(g.id));
}

/** @param {string} gameId */
export function getGameHref(gameId) {
  const routes = {
    "name-place-animal-thing": "/games/npat",
    "typing-race": "/games/typing-race",
    taboo: "/games/taboo",
    "cards-against-humanity": "/games/cah",
    hangman: "/games/hangman",
  };
  return routes[gameId] ?? "/games";
}

const CARD_GRADIENTS = [
  "from-pastel-mint to-accent-mint",
  "from-pastel-sky to-accent-sky",
  "from-pastel-peach to-primary",
  "from-pastel-lavender to-accent-purple",
];

/** @param {number} index */
export function getGameCardGradient(index) {
  return CARD_GRADIENTS[index % CARD_GRADIENTS.length];
}
