import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const TURN_READY_DELAY_MS = 3000;
const NEXT_ROUND_DELAY_MS = 10000;

class TabooError extends Error {
  constructor(message, code = "TABOO_ERROR") {
    super(message);
    this.code = code;
  }
}

function nowMs() {
  return Date.now();
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function normalizeGuess(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isCloseMatch(guess, answer) {
  const g = normalizeGuess(guess);
  const a = normalizeGuess(answer);
  if (!g || !a) return false;
  return a.includes(g) || g.includes(a);
}

function buildTurnOrder(players, roundNumber = 1) {
  const teamA = players.filter((player) => player.team === "A");
  const teamB = players.filter((player) => player.team === "B");
  if (!teamA.length || !teamB.length) return [];

  const roundIndex = Math.max(0, Number(roundNumber) - 1);
  const rotate = (arr, start) => arr.slice(start).concat(arr.slice(0, start));
  const rotatedA = rotate(teamA, roundIndex % teamA.length);
  const rotatedB = rotate(teamB, roundIndex % teamB.length);

  const order = [];
  let ai = 0;
  let bi = 0;
  let step = 0;
  while (ai < rotatedA.length || bi < rotatedB.length) {
    const expectA = step % 2 === 0;
    if (expectA && ai < rotatedA.length) {
      const p = rotatedA[ai++];
      order.push({ playerId: p.userId, playerName: p.username, team: "A" });
    } else if (!expectA && bi < rotatedB.length) {
      const p = rotatedB[bi++];
      order.push({ playerId: p.userId, playerName: p.username, team: "B" });
    }
    step += 1;
  }
  return order;
}

function viewerRole(room, userId) {
  if (!userId || !room?.game || room.game.status === "finished") return "spectator";
  const player = room.players.find((p) => p.userId === userId);
  if (!player || !room.game.activeTurn) return "spectator";
  if (room.game.activeTurn.playerId === userId) return "clue_giver";
  return player.team === room.game.activeTurn.team ? "teammate_guesser" : "opponent_observer";
}

export function createDeckProvider() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const datasetPath = path.resolve(moduleDir, "data", "taboo.json");
  const raw = fs.readFileSync(datasetPath, "utf8");
  const parsed = JSON.parse(raw);
  /** @type {Array<{id:string,question:string,taboo:string[],category:string,categoryId:number}>} */
  const cards = [];
  for (const category of Array.isArray(parsed) ? parsed : []) {
    const categoryName = String(category.category ?? "").trim();
    const categoryId = Number(category.categoryId ?? 0);
    for (const word of Array.isArray(category.words) ? category.words : []) {
      const question = String(word.question ?? "").trim();
      const taboo = Array.isArray(word.options) ? word.options.map((v) => String(v).trim()).filter(Boolean) : [];
      if (!question || taboo.length < 2) continue;
      cards.push({
        id: `${categoryId}:${question.toLowerCase()}`,
        question,
        taboo,
        category: categoryName,
        categoryId,
      });
    }
  }
  return () => shuffle(cards);
}

function drawNextCard(room) {
  const game = room.game;
  if (!game) return null;
  if (game.currentCard) game.discard.push({ ...game.currentCard, taboo: [...game.currentCard.taboo] });
  if (!game.deck.length) {
    game.deck = game.discard.length ? shuffle(game.discard) : room.makeDeck();
    game.discard = [];
  }
  game.currentCard = game.deck.shift() ?? null;
  game.currentCardMeta = { tabooUsed: false };
  return game.currentCard;
}

export function createGameManager() {
  function initializeGame(room) {
    if (room.players.length < 2) throw new TabooError("At least two players are required.", "NOT_ENOUGH_PLAYERS");
    if (!room.players.some((p) => p.team === "A") || !room.players.some((p) => p.team === "B")) {
      throw new TabooError("Each team must have at least one player.", "TEAM_EMPTY");
    }
    const deck = room.makeDeck();
    if (!deck.length) throw new TabooError("No cards available.", "EMPTY_DECK");
    const turnOrder = buildTurnOrder(room.players, 1);
    if (turnOrder.length < 2) throw new TabooError("At least two players are required.", "NOT_ENOUGH_PLAYERS");
    const activeTurn = turnOrder[0];
    room.game = {
      status: "waiting_to_start_turn",
      startedAt: nowMs(),
      endedAt: null,
      roundNumber: 1,
      totalRounds: room.settings.roundCount,
      activeTeam: activeTurn.team,
      activeTurn,
      turnOrder,
      turnIndex: 0,
      scores: { A: 0, B: 0 },
      turnStartsAt: null,
      turnEndsAt: null,
      phaseEndsAt: null,
      currentCard: deck.shift() ?? null,
      currentCardMeta: { tabooUsed: false },
      deck,
      discard: [],
      review: null,
      history: [],
      lastTurnSummary: null,
    };
  }

  function recordHistory(game, entry) {
    game.history = [...game.history.slice(-59), { ...entry, at: nowMs() }];
  }

  function advancePostTurn(room, reason = "turn_ended") {
    const game = room.game;
    const turnHistory = game.history.filter((e) => e.team === game.activeTeam && e.at >= (game.turnStartsAt || 0));
    const correctGuesses = turnHistory.filter((e) => e.action === "submit_guess" && e.matched).length;
    const skips = turnHistory.filter((e) => e.action === "skip_card").length;
    const taboos = turnHistory.filter((e) => e.action === "taboo_called").length;
    game.lastTurnSummary = {
      clueGiverName: game.activeTurn?.playerName || "Player",
      team: game.activeTeam,
      correctGuesses,
      skips,
      taboos,
      pointsEarned: correctGuesses - taboos,
    };
    game.review = null;
    drawNextCard(room);

    if (game.turnIndex < game.turnOrder.length - 1) {
      game.turnIndex += 1;
      game.activeTurn = game.turnOrder[game.turnIndex];
      game.activeTeam = game.activeTurn.team;
      game.status = "between_turns";
      game.phaseEndsAt = nowMs() + TURN_READY_DELAY_MS;
      game.turnStartsAt = null;
      game.turnEndsAt = null;
      return reason;
    }
    if (game.roundNumber >= game.totalRounds) {
      game.status = "finished";
      game.endedAt = nowMs();
      game.turnStartsAt = null;
      game.turnEndsAt = null;
      game.phaseEndsAt = null;
      game.currentCard = null;
      game.review = null;
      return "game_finished";
    }
    game.status = "between_rounds";
    game.phaseEndsAt = nowMs() + NEXT_ROUND_DELAY_MS;
    game.turnStartsAt = null;
    game.turnEndsAt = null;
    return "round_completed";
  }

  function resolveReview(room) {
    const review = room.game?.review;
    if (!review || review.status !== "in_progress") return false;
    const eligible = Array.isArray(review.eligiblePlayerIds) ? review.eligiblePlayerIds : [];
    if (!eligible.length) return false;
    const votes = review.votes || {};
    const hasAllVotes = eligible.every((pid) => votes[pid] === "fair" || votes[pid] === "not_fair");
    if (!hasAllVotes) return false;
    const notFair = eligible.filter((pid) => votes[pid] === "not_fair").length;
    const fair = eligible.length - notFair;
    const outcome = notFair > fair ? "reverted" : "upheld";
    if (outcome === "reverted") room.game.scores[review.penalizedTeam] += 1;
    review.status = "resolved";
    review.outcome = outcome;
    return true;
  }

  function applyAction(room, userId, action, payload = {}) {
    const player = room.players.find((p) => p.userId === userId);
    if (!player) throw new TabooError("Player not in room.", "PLAYER_NOT_FOUND");
    const game = room.game;
    if (!game || game.status === "finished") throw new TabooError("Game is not active.", "GAME_NOT_ACTIVE");

    if (action === "start_turn") {
      if (game.status !== "waiting_to_start_turn") throw new TabooError("Turn not ready.", "TURN_NOT_READY");
      if (game.activeTurn?.playerId !== userId) throw new TabooError("Only clue giver can start turn.", "NOT_CLUE_GIVER");
      game.status = "turn_in_progress";
      game.turnStartsAt = nowMs();
      game.turnEndsAt = nowMs() + room.settings.roundDurationSeconds * 1000;
      game.phaseEndsAt = null;
      return "turn_started";
    }

    if (action === "submit_guess") {
      if (game.status !== "turn_in_progress") throw new TabooError("Turn not in progress.", "TURN_NOT_IN_PROGRESS");
      if (game.review?.status === "in_progress") throw new TabooError("Review in progress.", "REVIEW_IN_PROGRESS");
      if (!game.activeTurn || player.team !== game.activeTurn.team) throw new TabooError("Only active team can guess.", "NOT_ACTIVE_TEAM");
      if (game.activeTurn.playerId === userId) throw new TabooError("Clue giver cannot guess.", "CLUE_GIVER_CANNOT_GUESS");
      const guess = String(payload.guess ?? "").trim();
      if (!guess) throw new TabooError("Guess cannot be empty.", "INVALID_GUESS");
      const answer = game.currentCard?.question ?? "";
      const exact = normalizeGuess(guess) === normalizeGuess(answer);
      const close = !exact && isCloseMatch(guess, answer);
      if (close) {
        recordHistory(game, { action: "close_guess", team: player.team, playerId: userId, playerName: player.username, guess, matched: false });
        return "guess_close";
      }
      recordHistory(game, { action: "submit_guess", team: player.team, playerId: userId, playerName: player.username, guess, matched: exact });
      if (!exact) return "guess_incorrect";
      game.scores[game.activeTeam] += 1;
      drawNextCard(room);
      return "guess_correct";
    }

    if (action === "skip_card") {
      if (game.status !== "turn_in_progress") throw new TabooError("Turn not in progress.", "TURN_NOT_IN_PROGRESS");
      if (game.activeTurn?.playerId !== userId) throw new TabooError("Only clue giver can skip.", "NOT_CLUE_GIVER");
      recordHistory(game, { action: "skip_card", team: player.team, playerId: userId, playerName: player.username });
      drawNextCard(room);
      return "skip_card";
    }

    if (action === "taboo_called") {
      if (game.status !== "turn_in_progress") throw new TabooError("Turn not in progress.", "TURN_NOT_IN_PROGRESS");
      if (game.activeTurn?.team === player.team) throw new TabooError("Only opponents can call taboo.", "TABOO_NOT_ALLOWED");
      if (game.currentCardMeta?.tabooUsed) throw new TabooError("Taboo already used.", "TABOO_ALREADY_USED");
      game.currentCardMeta = { ...game.currentCardMeta, tabooUsed: true };
      game.scores[game.activeTurn.team] -= 1;
      const remainingMs = typeof game.turnEndsAt === "number" ? Math.max(0, game.turnEndsAt - nowMs()) : 0;
      game.review = {
        id: crypto.randomUUID(),
        status: "available",
        tabooCard: game.currentCard ? { ...game.currentCard, taboo: [...game.currentCard.taboo] } : null,
        tabooCalledBy: { playerId: userId, playerName: player.username, team: player.team },
        penalizedTeam: game.activeTurn.team,
        votes: {},
        eligiblePlayerIds: [],
        pausedRemainingMs: remainingMs,
        outcome: null,
      };
      recordHistory(game, { action: "taboo_called", team: player.team, playerId: userId, playerName: player.username, penalizedTeam: game.activeTurn.team });
      return "taboo_called";
    }

    if (action === "request_review") {
      if (game.review?.status !== "available") throw new TabooError("No review available.", "REVIEW_NOT_AVAILABLE");
      if (player.team !== game.review.penalizedTeam) throw new TabooError("Only penalized team may request review.", "REVIEW_NOT_ALLOWED");
      const remainingMs = typeof game.turnEndsAt === "number" ? Math.max(0, game.turnEndsAt - nowMs()) : 0;
      game.turnEndsAt = null;
      game.review.status = "in_progress";
      game.review.pausedRemainingMs = remainingMs;
      game.review.votes = {};
      game.review.eligiblePlayerIds = room.players.filter((p) => p.team === game.review.penalizedTeam).map((p) => p.userId);
      return "review_started";
    }

    if (action === "dismiss_review") {
      if (game.review?.status !== "available") throw new TabooError("No review available.", "REVIEW_NOT_AVAILABLE");
      if (player.team !== game.review.penalizedTeam) throw new TabooError("Only penalized team may dismiss review.", "REVIEW_NOT_ALLOWED");
      game.review = null;
      return "review_dismissed";
    }

    if (action === "review_vote") {
      if (game.review?.status !== "in_progress") throw new TabooError("Review voting not active.", "REVIEW_NOT_ACTIVE");
      if (payload.vote !== "fair" && payload.vote !== "not_fair") throw new TabooError("Vote must be fair or not_fair.", "INVALID_VOTE");
      if (!game.review.eligiblePlayerIds.includes(userId)) throw new TabooError("Not eligible to vote.", "REVIEW_NOT_ELIGIBLE");
      game.review.votes[userId] = payload.vote;
      return resolveReview(room) ? "review_resolved" : "review_vote";
    }

    if (action === "review_continue") {
      if (game.review?.status !== "resolved") throw new TabooError("Review not resolved.", "REVIEW_NOT_RESOLVED");
      if (game.activeTurn?.playerId !== userId) throw new TabooError("Only clue giver can continue.", "REVIEW_CONTINUE_NOT_ALLOWED");
      const remainingMs = Math.max(0, Number(game.review.pausedRemainingMs || 0));
      drawNextCard(room);
      game.turnEndsAt = nowMs() + remainingMs;
      game.review = null;
      return "review_continued";
    }

    throw new TabooError("Unsupported action.", "INVALID_GAME_ACTION");
  }

  function advanceRoom(room) {
    const game = room.game;
    if (!game || game.status === "finished") return null;
    const now = nowMs();
    if (game.status === "turn_in_progress" && typeof game.turnEndsAt === "number" && game.turnEndsAt <= now) {
      recordHistory(game, { action: "turn_timeout", team: game.activeTeam, playerId: game.activeTurn?.playerId || null, playerName: game.activeTurn?.playerName || null });
      return advancePostTurn(room, "turn_timeout");
    }
    if (game.status === "between_turns" && typeof game.phaseEndsAt === "number" && game.phaseEndsAt <= now) {
      game.status = "waiting_to_start_turn";
      game.phaseEndsAt = null;
      game.turnStartsAt = null;
      game.turnEndsAt = null;
      return "next_turn_ready";
    }
    if (game.status === "between_rounds" && typeof game.phaseEndsAt === "number" && game.phaseEndsAt <= now) {
      game.roundNumber += 1;
      game.turnOrder = buildTurnOrder(room.players, game.roundNumber);
      if (!game.turnOrder.length) {
        game.status = "finished";
        game.endedAt = now;
        return "game_finished";
      }
      game.turnIndex = 0;
      game.activeTurn = game.turnOrder[0];
      game.activeTeam = game.activeTurn.team;
      game.status = "waiting_to_start_turn";
      game.phaseEndsAt = null;
      game.turnStartsAt = null;
      game.turnEndsAt = null;
      return "round_started";
    }
    if (game.status === "turn_in_progress" && game.review?.status !== "in_progress" && game.turnEndsAt && game.turnEndsAt <= now) {
      return advancePostTurn(room, "turn_timeout");
    }
    return null;
  }

  function maybeStartIfReady(room) {
    if (room.game) return false;
    if (room.players.length < 2) return false;
    if (!room.players.some((p) => p.team === "A") || !room.players.some((p) => p.team === "B")) return false;
    if (!room.players.every((p) => p.ready)) return false;
    initializeGame(room);
    return true;
  }

  function toSnapshot(room, userId) {
    const game = room.game;
    const role = viewerRole(room, userId);
    const me = room.players.find((p) => p.userId === userId) ?? null;
    const review = game?.review;
    const reviewPaused = review?.status === "in_progress" || review?.status === "resolved";
    const countdownEndsAt = reviewPaused ? null : (game?.turnEndsAt ?? game?.phaseEndsAt ?? null);
    const secondsRemaining = reviewPaused
      ? Math.max(0, Math.ceil((review?.pausedRemainingMs || 0) / 1000))
      : countdownEndsAt
        ? Math.max(0, Math.ceil((countdownEndsAt - nowMs()) / 1000))
        : 0;
    const hideCard = !game || game.status !== "turn_in_progress" || role === "spectator" || role === "teammate_guesser";
    const reviewSnapshot = review ? {
      id: review.id || null,
      status: review.status,
      tabooCard: review.tabooCard || null,
      tabooCalledBy: review.tabooCalledBy || null,
      penalizedTeam: review.penalizedTeam || null,
      votes: (review.eligiblePlayerIds || []).map((pid) => ({
        playerId: pid,
        playerName: room.players.find((p) => p.userId === pid)?.username || null,
        vote: review.votes?.[pid] || null,
      })),
      eligibleCount: (review.eligiblePlayerIds || []).length,
      fairCount: (review.eligiblePlayerIds || []).filter((pid) => review.votes?.[pid] === "fair").length,
      notFairCount: (review.eligiblePlayerIds || []).filter((pid) => review.votes?.[pid] === "not_fair").length,
      outcome: review.outcome || null,
    } : null;

    return {
      code: room.code,
      hostId: room.hostId,
      hostName: room.hostName,
      players: room.players.map((p) => ({ id: p.userId, name: p.username, team: p.team, ready: p.ready })),
      teams: {
        A: room.players.filter((p) => p.team === "A").map((p) => p.username),
        B: room.players.filter((p) => p.team === "B").map((p) => p.username),
      },
      allReady: room.players.length > 0 && room.players.every((p) => p.ready),
      settings: room.settings,
      game: game ? {
        status: game.status,
        startedAt: game.startedAt,
        endedAt: game.endedAt,
        roundNumber: game.roundNumber,
        totalRounds: game.totalRounds,
        nextRoundNumber: game.status === "between_rounds" ? Math.min(game.totalRounds, game.roundNumber + 1) : game.roundNumber,
        activeTeam: game.activeTeam,
        activeTurn: game.activeTurn ? { ...game.activeTurn, turnIndexInRound: game.turnIndex + 1, totalTurnsInRound: game.turnOrder.length } : null,
        scores: { ...game.scores },
        turnStartsAt: game.turnStartsAt,
        turnEndsAt: game.turnEndsAt,
        phaseEndsAt: game.phaseEndsAt,
        roundEndsAt: reviewPaused ? null : game.turnEndsAt,
        secondsRemaining,
        viewerRole: role,
        permissions: {
          canStartTurn: role === "clue_giver" && game.status === "waiting_to_start_turn",
          canSubmitGuess: role === "teammate_guesser" && game.status === "turn_in_progress" && !reviewPaused,
          canSkipCard: role === "clue_giver" && game.status === "turn_in_progress" && !reviewPaused,
          canCallTaboo: role === "opponent_observer" && game.status === "turn_in_progress" && !game.currentCardMeta?.tabooUsed && !reviewPaused,
          canRequestReview: review?.status === "available" && !!me?.team && me.team === review?.penalizedTeam,
          canDismissReview: review?.status === "available" && !!me?.team && me.team === review?.penalizedTeam,
          canVoteReview: review?.status === "in_progress" && !!me && (review?.eligiblePlayerIds || []).includes(me.userId),
          canContinueAfterReview: review?.status === "resolved" && game.activeTurn?.playerId === me?.userId,
        },
        currentCard: hideCard ? null : game.currentCard,
        cardVisibleToViewer: !hideCard,
        tabooUsedForCard: !!game.currentCardMeta?.tabooUsed,
        lastTurnSummary: game.lastTurnSummary || null,
        history: game.status === "finished" ? game.history : game.history.slice(-12),
        review: reviewSnapshot,
      } : null,
    };
  }

  return {
    TabooError,
    maybeStartIfReady,
    applyAction,
    advanceRoom,
    toSnapshot,
  };
}
