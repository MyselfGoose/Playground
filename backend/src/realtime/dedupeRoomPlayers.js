/**
 * Remove duplicate roster entries for the same user (e.g. concurrent join_room from multiple tabs).
 *
 * @template {{ userId: string }} T
 * @param {T[]} players
 * @returns {T[]}
 */
export function dedupeRoomPlayersByUserId(players) {
  const seen = new Set();
  return players.filter((player) => {
    const userId = String(player.userId ?? "");
    if (!userId || seen.has(userId)) return false;
    seen.add(userId);
    return true;
  });
}

/**
 * @param {{ players: Array<{ userId: string }> }} room
 */
export function dedupeRoomPlayersInPlace(room) {
  room.players = dedupeRoomPlayersByUserId(room.players);
}
