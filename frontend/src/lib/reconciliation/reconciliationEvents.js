/** Global reconciliation triggers (plan: centralized recovery bus). */

export const RECONCILE_EVENT = "playgrounds:reconcile";

/**
 * @param {string} [reason]
 */
export function dispatchReconcile(reason = "manual") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RECONCILE_EVENT, { detail: { reason } }));
}

/**
 * @param {(detail: { reason?: string }) => void} handler
 * @returns {() => void}
 */
export function subscribeReconcile(handler) {
  if (typeof window === "undefined") return () => {};
  /** @param {Event} e */
  const fn = (e) => {
    const d = /** @type {CustomEvent} */ (e).detail;
    handler(d ?? {});
  };
  window.addEventListener(RECONCILE_EVENT, fn);
  return () => window.removeEventListener(RECONCILE_EVENT, fn);
}

/** Call after `POST /auth/refresh` succeeds (cookies rotated). */
export function notifyRefreshCompleted() {
  dispatchReconcile("token_refresh");
}
