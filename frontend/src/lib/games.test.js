import { describe, it, expect } from "vitest";
import {
  PLAYABLE_GAME_IDS,
  getComingSoonGames,
  getGameHref,
  getPlayableGames,
} from "./games.js";

describe("games catalog", () => {
  it("getPlayableGames returns 5 games", () => {
    const playable = getPlayableGames();
    expect(playable).toHaveLength(5);
    expect(playable.map((g) => g.id).sort()).toEqual([...PLAYABLE_GAME_IDS].sort());
  });

  it("getComingSoonGames returns trivia and mcq-challenge", () => {
    const comingSoon = getComingSoonGames();
    expect(comingSoon).toHaveLength(2);
    expect(comingSoon.map((g) => g.id)).toEqual(["trivia", "mcq-challenge"]);
  });

  it("getGameHref maps playable games to routes", () => {
    expect(getGameHref("name-place-animal-thing")).toBe("/games/npat");
    expect(getGameHref("typing-race")).toBe("/games/typing-race");
    expect(getGameHref("taboo")).toBe("/games/taboo");
    expect(getGameHref("cards-against-humanity")).toBe("/games/cah");
    expect(getGameHref("hangman")).toBe("/games/hangman");
    expect(getGameHref("unknown")).toBe("/games");
  });
});
