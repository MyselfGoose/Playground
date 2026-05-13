/**
 * Shared Socket.IO utilities used by all game socket contexts.
 */

export const ACK_TIMEOUT_MS = 15_000;

/**
 * Turn a socket ack envelope into a normalized result object.
 * Server-side contract:
 *   success: `{ ok: true, data }`
 *   failure: `{ ok: false, error: { code, message } }`
 *
 * @param {unknown} err - Timeout or transport error from Socket.IO
 * @param {unknown} res - Server ack response
 * @returns {{ ok: true, data: unknown } | { ok: false, error: Error & { code: string } }}
 */
export function ackToResult(err, res) {
  if (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    /** @type {any} */ (e).code = /** @type {any} */ (e).code ?? "ACK_TIMEOUT";
    return { ok: false, error: e };
  }
  if (!res || typeof res !== "object") {
    return {
      ok: false,
      error: Object.assign(new Error("Malformed server response"), { code: "BAD_ACK" }),
    };
  }
  if (res.ok === true) {
    return { ok: true, data: res.data ?? null };
  }
  const failure = res.error ?? {};
  const msg = typeof failure.message === "string" ? failure.message : "Request failed";
  const code = typeof failure.code === "string" ? failure.code : "UNKNOWN";
  return { ok: false, error: Object.assign(new Error(msg), { code }) };
}

/**
 * Emit a socket event with ack and return a Promise that resolves to
 * `{ ok, data | error }`. Never throws — the caller inspects `ok`.
 *
 * @param {import('socket.io-client').Socket | null} socket
 * @param {string} event
 * @param {unknown} payload
 */
export function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({
        ok: false,
        error: Object.assign(new Error("Not connected to game server"), {
          code: "NOT_CONNECTED",
        }),
      });
      return;
    }
    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, res) => {
      const result = ackToResult(err, res);
      resolve(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error });
    });
  });
}

/**
 * Fetch a short-lived socket admission token from the REST API.
 * @param {typeof import('../api.js').apiFetch} apiFetchFn
 */
export async function fetchAdmissionToken(apiFetchFn) {
  const json = await apiFetchFn("/api/v1/auth/socket-admission");
  const tok = json?.data?.token;
  if (!tok) throw new Error("missing admission token");
  return tok;
}
