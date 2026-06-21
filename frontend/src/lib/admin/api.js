import { apiFetch } from "../api.js";

/**
 * @template T
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<T>}
 */
async function adminFetch(path, options = {}) {
  const res = await apiFetch(`/api/v1/admin${path}`, options);
  if (res && typeof res === "object" && "data" in res) {
    return /** @type {T} */ (res.data);
  }
  return /** @type {T} */ (res);
}

export function fetchAdminDashboard() {
  return adminFetch("/dashboard");
}

export function fetchAdminUsers(params) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return adminFetch(`/users${query ? `?${query}` : ""}`);
}

export function fetchAdminUser(id) {
  return adminFetch(`/users/${encodeURIComponent(id)}`);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export function patchAdminUser(id, body) {
  return adminFetch(`/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function removeAdminUserAvatar(id) {
  return adminFetch(`/users/${encodeURIComponent(id)}/avatar`, { method: "DELETE" });
}

/**
 * @param {string} id
 * @param {Record<string, number>} patch
 */
export function patchAdminUserStats(id, patch) {
  return adminFetch(`/users/${encodeURIComponent(id)}/stats`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch }),
  });
}

export function fetchAdminUserMatches(id, params) {
  const qs = new URLSearchParams();
  if (params?.game) qs.set("game", params.game);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.skip) qs.set("skip", String(params.skip));
  const query = qs.toString();
  return adminFetch(`/users/${encodeURIComponent(id)}/matches${query ? `?${query}` : ""}`);
}

export function fetchAdminUserAudit(id, params) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.skip) qs.set("skip", String(params.skip));
  const query = qs.toString();
  return adminFetch(`/users/${encodeURIComponent(id)}/audit${query ? `?${query}` : ""}`);
}

export function recomputeLeaderboards() {
  return adminFetch("/actions/recompute-leaderboards", { method: "POST" });
}

/**
 * @param {{ maintenanceMode: boolean, maintenanceMessage?: string }} body
 */
export function patchMaintenance(body) {
  return adminFetch("/settings/maintenance", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchAdminFeedback(params) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.perPage) qs.set("perPage", String(params.perPage));
  if (params?.state) qs.set("state", params.state);
  const query = qs.toString();
  return adminFetch(`/feedback${query ? `?${query}` : ""}`);
}

export function getAdminUsersExportUrl() {
  return "/api/v1/admin/users/export";
}
