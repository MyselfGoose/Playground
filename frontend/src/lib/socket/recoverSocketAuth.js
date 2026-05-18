/**
 * Shared recovery after Socket.IO handshake rejects credentials (mobile-prone).
 * Rotates HTTP-only cookies, mints a fresh admission JWT, then nudges reconnect.
 */

/** @type {WeakMap<import("socket.io-client").Socket, number>} */
const lastRecoveryAt = new WeakMap();

/**
 * Debounce window for refresh + admission recovery after handshake failure (BUG-S03).
 * Rapid failures within this window are dropped to avoid refresh/admission storms.
 * A subsequent failure after the window elapses may run recovery again (intentional).
 */
const DEBOUNCE_MS = 400;

/**
 * @param {import("socket.io-client").Socket} socket
 * @param {typeof import("../api.js").apiFetch} apiFetchFn
 * @param {() => Promise<string>} fetchAdmissionTokenFn
 */
export async function recoverSocketAuthAfterHandshakeFailure(socket, apiFetchFn, fetchAdmissionTokenFn) {
  const now = Date.now();
  const prev = lastRecoveryAt.get(socket) ?? 0;
  if (now - prev < DEBOUNCE_MS) return;
  lastRecoveryAt.set(socket, now);

  await apiFetchFn("/api/v1/auth/refresh", { method: "POST" });
  const fresh = await fetchAdmissionTokenFn();
  socket.auth = { token: fresh };
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
}
