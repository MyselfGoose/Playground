/**
 * Shared recovery after Socket.IO handshake rejects credentials (mobile-prone).
 * Rotates HTTP-only cookies, mints a fresh admission JWT, then nudges reconnect.
 *
 * Returns `{ deferred: true }` when debounced so callers can distinguish
 * "recovery in progress" from "recovery completed successfully".
 */

import { coordinatedRefresh } from "../session/coordinatedRefresh.js";

/** @type {WeakMap<import("socket.io-client").Socket, number>} */
const lastRecoveryAt = new WeakMap();

/** @type {WeakMap<import("socket.io-client").Socket, ReturnType<typeof setTimeout> | null>} */
const trailingRecoveryTimer = new WeakMap();

/**
 * Debounce window for refresh + admission recovery after handshake failure.
 * Rapid failures within this window are deferred to avoid refresh/admission storms.
 */
const DEBOUNCE_MS = 400;

/** @typedef {{ deferred?: boolean }} RecoveryResult */

/**
 * @param {import("socket.io-client").Socket} socket
 * @param {typeof import("../api.js").apiFetch} _apiFetchFn - Deprecated, kept for backward compat. Uses coordinatedRefresh internally.
 * @param {() => Promise<string>} fetchAdmissionTokenFn
 * @returns {Promise<RecoveryResult>}
 */
export async function recoverSocketAuthAfterHandshakeFailure(socket, _apiFetchFn, fetchAdmissionTokenFn) {
  const coordinatedRefreshFn = coordinatedRefresh;
  const now = Date.now();
  const prev = lastRecoveryAt.get(socket) ?? 0;
  if (now - prev < DEBOUNCE_MS) {
    const existing = trailingRecoveryTimer.get(socket);
    if (existing) clearTimeout(existing);
    trailingRecoveryTimer.set(
      socket,
      setTimeout(() => {
        trailingRecoveryTimer.delete(socket);
        void recoverSocketAuthAfterHandshakeFailure(socket, _apiFetchFn, fetchAdmissionTokenFn);
      }, DEBOUNCE_MS - (now - prev) + 10),
    );
    return { deferred: true };
  }
  lastRecoveryAt.set(socket, now);
  const pending = trailingRecoveryTimer.get(socket);
  if (pending) {
    clearTimeout(pending);
    trailingRecoveryTimer.delete(socket);
  }

  await coordinatedRefreshFn();
  const fresh = await fetchAdmissionTokenFn();
  socket.auth = { token: fresh };
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
  return {};
}
