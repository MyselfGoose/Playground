import { createDeckProvider, createGameManager } from "./gameManager.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { persistTabooResults } from "../../services/leaderboardStatsService.js";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function createTabooRoomManager({ tabooNs, logger }) {
  const game = createGameManager();
  const makeDeckAll = createDeckProvider();
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const datasetPath = path.resolve(moduleDir, "data", "taboo.json");
  /** @type {Array<{categoryId:number, category:string, wordCount:number, selectable:boolean}>} */
  const categorySummaries = (() => {
    try {
      const raw = fs.readFileSync(datasetPath, "utf8");
      const parsed = JSON.parse(raw);
      return (Array.isArray(parsed) ? parsed : [])
        .map((entry) => {
          const categoryId = Number(entry?.categoryId ?? 0);
          const category = String(entry?.category ?? "").trim();
          const words = Array.isArray(entry?.words) ? entry.words : [];
          const wordCount = words.filter((w) => String(w?.question ?? "").trim()).length;
          return {
            categoryId,
            category,
            wordCount,
            selectable: Number.isInteger(categoryId) && categoryId > 0 && wordCount > 0,
          };
        })
        .filter((entry) => entry.selectable);
    } catch {
      return [];
    }
  })();

  function resolveCategorySelection(settings) {
    const requestedMode = settings?.categoryMode === "single" ? "single" : "all";
    if (requestedMode === "all") {
      const allIds = categorySummaries.map((c) => c.categoryId);
      return {
        categoryMode: "all",
        categoryIds: allIds,
        categoryNames: ["All Categories"],
      };
    }
    const requestedId = Number(Array.isArray(settings?.categoryIds) ? settings.categoryIds[0] : 0);
    const selected = categorySummaries.find((c) => c.categoryId === requestedId);
    if (!selected) {
      throw Object.assign(new Error("Selected category is invalid."), { code: "INVALID_CATEGORY" });
    }
    return {
      categoryMode: "single",
      categoryIds: [selected.categoryId],
      categoryNames: [selected.category],
    };
  }

  function makeDeckForCategories(categoryIds) {
    const base = makeDeckAll();
    if (!Array.isArray(categoryIds) || !categoryIds.length) return base;
    const allowed = new Set(categoryIds);
    return base.filter((card) => allowed.has(card.categoryId));
  }
  /** @type {Map<string, any>} */
  const rooms = new Map();
  /** @type {Map<string, string>} */
  const socketToCode = new Map();
  /** @type {Map<string, string>} */
  const userToCode = new Map();
  /** @type {Map<string, Set<string>>} */
  const userToSocketIds = new Map();

  function trackUserSocket(userId, socketId) {
    const set = userToSocketIds.get(userId) ?? new Set();
    set.add(socketId);
    userToSocketIds.set(userId, set);
  }

  function untrackUserSocket(userId, socketId) {
    const set = userToSocketIds.get(userId);
    if (!set) return;
    set.delete(socketId);
    if (!set.size) userToSocketIds.delete(userId);
  }

  function getRoomForSocket(socket) {
    const code = socketToCode.get(socket.id);
    return code ? (rooms.get(code) ?? null) : null;
  }

  function bumpStateVersion(room) {
    room.stateVersion = Number(room.stateVersion || 0) + 1;
  }

  function emitRoom(code, reason = "room_update") {
    const room = rooms.get(code);
    if (!room) return;
    for (const socketId of room.socketIds) {
      const socket = tabooNs.sockets.get(socketId);
      if (!socket) continue;
      socket.emit("room_update", { reason, room: game.toSnapshot(room, socket.data.userId) });
    }
  }

  function maybePersistTabooFinished(room) {
    if (!room?.game || room.game.status !== "finished") return;
    if (room.tabooStatsPersisted) return;
    room.tabooStatsPersisted = true;
    void persistTabooResults({
      code: room.code,
      game: room.game,
      players: room.players,
      logger,
    });
  }

  function createRoom(socket, hostId, hostName, settings) {
    leaveRoom(socket, { hardLeave: true });
    let code = "";
    for (let i = 0; i < 40; i += 1) {
      const candidate = randomCode();
      if (!rooms.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) throw Object.assign(new Error("Could not allocate room"), { code: "ROOM_ALLOC_FAIL" });
    const categorySelection = resolveCategorySelection(settings);
    const room = {
      code,
      hostId,
      hostName,
      settings: {
        roundCount: Number(settings?.roundCount ?? 5),
        roundDurationSeconds: Number(settings?.roundDurationSeconds ?? 60),
        categoryMode: categorySelection.categoryMode,
        categoryIds: categorySelection.categoryIds,
        categoryNames: categorySelection.categoryNames,
      },
      players: [{ userId: hostId, username: hostName, team: "A", ready: false, connected: true }],
      game: null,
      makeDeck: () => makeDeckForCategories(categorySelection.categoryIds),
      socketIds: new Set([socket.id]),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stateVersion: 1,
      tabooStatsPersisted: false,
    };
    rooms.set(code, room);
    socketToCode.set(socket.id, code);
    userToCode.set(hostId, code);
    trackUserSocket(hostId, socket.id);
    socket.join(code);
    return room;
  }

  function joinRoom(code, socket, userId, username) {
    const normalized = String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (normalized.length !== 4) throw Object.assign(new Error("Invalid room code"), { code: "VALIDATION_ERROR" });
    const room = rooms.get(normalized);
    if (!room) throw Object.assign(new Error("Room not found"), { code: "ROOM_NOT_FOUND" });
    const existing = room.players.find((p) => p.userId === userId);
    if (!existing && room.game?.status && room.game.status !== "finished") {
      throw Object.assign(new Error("Game already started"), { code: "ROOM_LOCKED" });
    }
    leaveRoom(socket, { hardLeave: false });
    if (existing) {
      existing.connected = true;
      existing.username = username;
    } else {
      const countA = room.players.filter((p) => p.team === "A").length;
      const countB = room.players.filter((p) => p.team === "B").length;
      room.players.push({ userId, username, team: countA <= countB ? "A" : "B", ready: false, connected: true });
    }
    bumpStateVersion(room);
    room.socketIds.add(socket.id);
    room.updatedAt = Date.now();
    socketToCode.set(socket.id, normalized);
    userToCode.set(userId, normalized);
    trackUserSocket(userId, socket.id);
    socket.join(normalized);
    return room;
  }

  function leaveRoom(socket, { hardLeave }) {
    const code = socketToCode.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    socketToCode.delete(socket.id);
    untrackUserSocket(socket.data.userId, socket.id);
    socket.leave(code);
    if (!room) return;
    room.socketIds.delete(socket.id);
    const userId = socket.data.userId;
    const player = room.players.find((p) => p.userId === userId);
    if (player) {
      if (hardLeave) {
        const hasOtherSockets = [...room.socketIds].some((sid) => tabooNs.sockets.get(sid)?.data?.userId === userId);
        if (!hasOtherSockets) {
          room.players = room.players.filter((p) => p.userId !== userId);
          userToCode.delete(userId);
        } else {
          player.connected = true;
        }
      } else {
        player.connected = false;
      }
      bumpStateVersion(room);
      room.updatedAt = Date.now();
    }
    if (!room.players.length) rooms.delete(code);
  }

  function attachActiveRoomForUser(socket) {
    const code = userToCode.get(socket.data.userId);
    if (!code) return null;
    const room = rooms.get(code);
    if (!room) return null;
    room.socketIds.add(socket.id);
    socketToCode.set(socket.id, code);
    socket.join(code);
    trackUserSocket(socket.data.userId, socket.id);
    const player = room.players.find((p) => p.userId === socket.data.userId);
    if (player) {
      player.connected = true;
      bumpStateVersion(room);
      room.updatedAt = Date.now();
    }
    return room;
  }

  function setReady(socket, ready) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error("Not in room"), { code: "NOT_IN_ROOM" });
    const me = room.players.find((p) => p.userId === socket.data.userId);
    if (!me) throw Object.assign(new Error("Player not found"), { code: "PLAYER_NOT_FOUND" });
    me.ready = Boolean(ready);
    const started = game.maybeStartIfReady(room);
    if (started) room.tabooStatsPersisted = false;
    bumpStateVersion(room);
    room.updatedAt = Date.now();
    return { room, started };
  }

  function changeTeam(socket, team) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error("Not in room"), { code: "NOT_IN_ROOM" });
    if (room.game && room.game.status !== "finished") {
      throw Object.assign(new Error("Cannot change team after game start"), { code: "GAME_ALREADY_STARTED" });
    }
    const me = room.players.find((p) => p.userId === socket.data.userId);
    if (!me) throw Object.assign(new Error("Player not found"), { code: "PLAYER_NOT_FOUND" });
    me.team = team === "B" ? "B" : "A";
    me.ready = false;
    bumpStateVersion(room);
    room.updatedAt = Date.now();
    return room;
  }

  function startGame(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error("Not in room"), { code: "NOT_IN_ROOM" });
    const me = room.players.find((p) => p.userId === socket.data.userId);
    if (!me) throw Object.assign(new Error("Player not found"), { code: "PLAYER_NOT_FOUND" });
    if (room.hostId !== me.userId) throw Object.assign(new Error("Only host can start"), { code: "NOT_HOST" });
    if (!game.maybeStartIfReady(room)) throw Object.assign(new Error("All players must be ready and both teams non-empty"), { code: "READY_REQUIRED" });
    room.tabooStatsPersisted = false;
    bumpStateVersion(room);
    room.updatedAt = Date.now();
    return room;
  }

  function setCategories(socket, payload) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error("Not in room"), { code: "NOT_IN_ROOM" });
    const me = room.players.find((p) => p.userId === socket.data.userId);
    if (!me) throw Object.assign(new Error("Player not found"), { code: "PLAYER_NOT_FOUND" });
    if (room.hostId !== me.userId) throw Object.assign(new Error("Only host can change categories"), { code: "NOT_HOST" });
    if (room.game) throw Object.assign(new Error("Cannot change categories after game start"), { code: "GAME_ALREADY_STARTED" });
    const selection = resolveCategorySelection(payload);
    room.settings.categoryMode = selection.categoryMode;
    room.settings.categoryIds = selection.categoryIds;
    room.settings.categoryNames = selection.categoryNames;
    room.makeDeck = () => makeDeckForCategories(selection.categoryIds);
    bumpStateVersion(room);
    room.updatedAt = Date.now();
    return room;
  }

  function listCategories() {
    return categorySummaries.map((c) => ({
      categoryId: c.categoryId,
      category: c.category,
      wordCount: c.wordCount,
      selectable: c.selectable,
    }));
  }

  function applyAction(socket, action, payload) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error("Not in room"), { code: "NOT_IN_ROOM" });
    const reason = game.applyAction(room, socket.data.userId, action, payload);
    bumpStateVersion(room);
    room.updatedAt = Date.now();
    if (reason === "turn_timeout") {
      game.advanceRoom(room);
    }
    maybePersistTabooFinished(room);
    return { room, reason };
  }

  function tick() {
    /** @type {Array<{code:string,reason:string}>} */
    const updates = [];
    for (const [code, room] of rooms.entries()) {
      const reason = game.advanceRoom(room);
      if (reason) {
        bumpStateVersion(room);
        room.updatedAt = Date.now();
        updates.push({ code, reason });
        maybePersistTabooFinished(room);
      }
    }
    return updates;
  }

  function snapshotFor(socket) {
    const room = getRoomForSocket(socket);
    if (!room) return null;
    return game.toSnapshot(room, socket.data.userId);
  }

  function shutdown() {
    rooms.clear();
    socketToCode.clear();
    userToCode.clear();
    userToSocketIds.clear();
  }

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    changeTeam,
    startGame,
    setCategories,
    listCategories,
    applyAction,
    emitRoom,
    tick,
    snapshotFor,
    getRoomForSocket,
    attachActiveRoomForUser,
    shutdown,
  };
}
