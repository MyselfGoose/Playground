"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  fetchAdminUser,
  patchAdminUser,
  removeAdminUserAvatar,
  patchAdminUserStats,
  fetchAdminUserMatches,
  fetchAdminUserAudit,
} from "../../lib/admin/api.js";
import { Card } from "../ui/Card.jsx";
import { Badge } from "../ui/Badge.jsx";
import { Button } from "../Button.jsx";
import { Input } from "../ui/Input.jsx";
import { LoadingSkeleton } from "../LoadingSkeleton.jsx";
import { Avatar } from "../Avatar.jsx";

const ROLE_OPTIONS = ["user", "admin", "moderator"];
const GAME_FILTERS = ["all", "typing-race", "npat", "taboo", "hangman", "cah"];

export function UserDetailView() {
  const params = useParams();
  const userId = typeof params?.id === "string" ? params.id : "";

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const [usernameDraft, setUsernameDraft] = useState("");
  const [rolesDraft, setRolesDraft] = useState([]);
  const [modStatus, setModStatus] = useState("none");
  const [modReason, setModReason] = useState("");
  const [modExpires, setModExpires] = useState("");
  const [modNotes, setModNotes] = useState("");
  const [statField, setStatField] = useState("typing_totalGames");
  const [statValue, setStatValue] = useState("");

  const [matches, setMatches] = useState(null);
  const [matchGame, setMatchGame] = useState("all");
  const [audit, setAudit] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUser(userId);
      setDetail(data);
      setUsernameDraft(data.user.username);
      setRolesDraft(data.user.roles ?? ["user"]);
      setModStatus(data.user.moderation?.status ?? "none");
      setModReason(data.user.moderation?.reason ?? "");
      setModNotes(data.user.moderation?.internalNotes ?? "");
      setModExpires(
        data.user.moderation?.expiresAt
          ? new Date(data.user.moderation.expiresAt).toISOString().slice(0, 16)
          : "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadMatches = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchAdminUserMatches(userId, { game: matchGame, limit: 25 });
      setMatches(data);
    } catch {
      setMatches({ matches: [] });
    }
  }, [userId, matchGame]);

  const loadAudit = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchAdminUserAudit(userId);
      setAudit(data);
    } catch {
      setAudit({ entries: [] });
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const run = async (fn) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage("Saved successfully");
      await load();
      await loadAudit();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !detail) return <LoadingSkeleton variant="card" />;
  if (error) {
    return (
      <Card>
        <p className="text-error">{error}</p>
        <Link href="/admin/users" className="mt-4 inline-block text-sm text-primary">
          Back to users
        </Link>
      </Card>
    );
  }

  const user = detail?.user;
  const stats = detail?.stats;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/users" className="text-sm font-medium text-primary hover:underline">
          ← Users
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold">{user?.username}</h1>
        <p className="text-sm text-muted">{user?.email}</p>
      </div>

      {message ? (
        <p className="rounded-xl bg-muted-bright/30 px-4 py-2 text-sm" role="status">
          {message}
        </p>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-start gap-6">
          <Avatar
            username={user?.username ?? ""}
            avatarUrl={user?.avatarUrl}
            avatarEmoji={user?.avatarEmoji}
            size="lg"
          />
          <dl className="grid flex-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">User ID</dt>
              <dd className="font-mono text-xs">{user?.id}</dd>
            </div>
            <div>
              <dt className="text-muted">Google ID</dt>
              <dd className="font-mono text-xs">{user?.googleId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Providers</dt>
              <dd>{(user?.authProviders ?? []).join(", ")}</dd>
            </div>
            <div>
              <dt className="text-muted">Created</dt>
              <dd>{user?.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Last login</dt>
              <dd>{user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Status</dt>
              <dd>
                {user?.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="error">Inactive</Badge>}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Account actions</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(() => patchAdminUser(userId, { isActive: !user?.isActive, reason: "Admin toggle" }))
              }
            >
              {user?.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void run(() => removeAdminUserAvatar(userId))}
            >
              Remove avatar
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Force username" value={usernameDraft} onChange={(e) => setUsernameDraft(e.target.value)} />
            <div className="flex items-end">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void run(() => patchAdminUser(userId, { username: usernameDraft }))}
              >
                Save username
              </Button>
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-bold">Roles</legend>
            <div className="flex flex-wrap gap-4">
              {ROLE_OPTIONS.map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rolesDraft.includes(role)}
                    onChange={(e) => {
                      setRolesDraft((prev) =>
                        e.target.checked ? [...new Set([...prev, role])] : prev.filter((r) => r !== role),
                      );
                    }}
                  />
                  {role}
                </label>
              ))}
            </div>
            <Button
              className="mt-3"
              variant="secondary"
              disabled={busy}
              onClick={() => void run(() => patchAdminUser(userId, { roles: rolesDraft }))}
            >
              Save roles
            </Button>
          </fieldset>

          <fieldset className="rounded-xl border border-muted-bright/40 p-4">
            <legend className="px-1 text-sm font-bold">Moderation</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Status
                <select
                  className="mt-1 w-full rounded-xl border border-muted-bright/50 bg-background px-3 py-2"
                  value={modStatus}
                  onChange={(e) => setModStatus(e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="suspended">Suspended</option>
                  <option value="banned">Banned</option>
                </select>
              </label>
              <Input label="Expires (optional)" type="datetime-local" value={modExpires} onChange={(e) => setModExpires(e.target.value)} />
              <Input label="Reason" value={modReason} onChange={(e) => setModReason(e.target.value)} className="sm:col-span-2" />
              <label className="text-sm sm:col-span-2">
                Internal notes
                <textarea
                  className="mt-1 w-full rounded-xl border border-muted-bright/50 bg-background px-3 py-2 text-sm"
                  rows={3}
                  value={modNotes}
                  onChange={(e) => setModNotes(e.target.value)}
                />
              </label>
            </div>
            <Button
              className="mt-3"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  patchAdminUser(userId, {
                    moderation: {
                      status: modStatus,
                      reason: modReason,
                      internalNotes: modNotes,
                      expiresAt: modExpires ? new Date(modExpires).toISOString() : null,
                    },
                  }),
                )
              }
            >
              Apply moderation
            </Button>
          </fieldset>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Stats</h2>
        {!stats ? (
          <p className="text-sm text-muted">No stats recorded</p>
        ) : (
          <>
            <div className="mb-4 max-h-64 overflow-auto rounded-xl bg-muted-bright/10 p-3 font-mono text-xs">
              <pre>{JSON.stringify(stats, null, 2)}</pre>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                Field
                <select
                  className="mt-1 block rounded-xl border border-muted-bright/50 bg-background px-3 py-2"
                  value={statField}
                  onChange={(e) => setStatField(e.target.value)}
                >
                  {Object.keys(stats)
                    .filter((k) => !k.startsWith("_") && k !== "userId" && k !== "username")
                    .map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                </select>
              </label>
              <Input label="New value" type="number" value={statValue} onChange={(e) => setStatValue(e.target.value)} />
              <Button
                variant="secondary"
                disabled={busy || statValue === ""}
                onClick={() =>
                  void run(() =>
                    patchAdminUserStats(userId, { [statField]: Number(statValue) }),
                  )
                }
              >
                Patch stat
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Match history</h2>
          <select
            className="rounded-xl border border-muted-bright/50 bg-background px-3 py-1.5 text-sm"
            value={matchGame}
            onChange={(e) => setMatchGame(e.target.value)}
          >
            {GAME_FILTERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          {(matches?.matches ?? []).length === 0 ? (
            <p className="text-sm text-muted">No matches</p>
          ) : (
            matches.matches.map((m, i) => (
              <div key={`${m.game}-${m.finishedAt}-${i}`} className="rounded-lg bg-muted-bright/15 px-3 py-2 text-sm">
                <span className="font-bold">{m.game}</span>
                <span className="mx-2 text-muted">·</span>
                <span>{new Date(m.finishedAt).toLocaleString()}</span>
                {m.roomCode ? <span className="ml-2 text-muted">room {m.roomCode}</span> : null}
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Audit log</h2>
        <ul className="space-y-2 text-sm">
          {(audit?.entries ?? []).length === 0 ? (
            <li className="text-muted">No audit entries</li>
          ) : (
            audit.entries.map((e) => (
              <li key={e.id} className="rounded-lg border border-muted-bright/30 px-3 py-2">
                <span className="font-bold">{e.action}</span>
                <span className="mx-2 text-muted">·</span>
                <span className="text-muted">{new Date(e.createdAt).toLocaleString()}</span>
                {e.reason ? <p className="mt-1 text-muted">{e.reason}</p> : null}
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
