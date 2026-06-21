"use client";

import Link from "next/link";
import { useState } from "react";
import { Download } from "lucide-react";
import { useAdminUsers } from "../../hooks/useAdminUsers.js";
import { getAdminUsersExportUrl } from "../../lib/admin/api.js";
import { Card } from "../ui/Card.jsx";
import { Badge } from "../ui/Badge.jsx";
import { Button } from "../Button.jsx";
import { Input } from "../ui/Input.jsx";
import { LoadingSkeleton } from "../LoadingSkeleton.jsx";

export function UserSearchView() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAdminUsers({ q, page, limit: 20 });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted">Search by username, email, user ID, or Google ID</p>
        </div>
        <a href={getAdminUsersExportUrl()} download className="inline-flex">
          <Button variant="secondary" type="button">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </a>
      </div>

      <Card className="!p-4">
        <Input
          label="Search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="username, email, or ID…"
        />
      </Card>

      {loading && !data ? <LoadingSkeleton variant="card" /> : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}

      {data ? (
        <>
          <div className="overflow-x-auto rounded-2xl ring-1 ring-muted-bright/40">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted-bright/20 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3">Last login</th>
                </tr>
              </thead>
              <tbody>
                {data.users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      No users found
                    </td>
                  </tr>
                ) : (
                  data.users.map((u) => (
                    <tr key={u.id} className="border-t border-muted-bright/30">
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${u.id}`} className="font-bold text-primary hover:underline">
                          {u.username}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{u.email}</td>
                      <td className="px-4 py-3">
                        {!u.isActive ? (
                          <Badge tone="error">Inactive</Badge>
                        ) : u.moderation?.status && u.moderation.status !== "none" ? (
                          <Badge tone="warning">{u.moderation.status}</Badge>
                        ) : (
                          <Badge tone="success">Active</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">{(u.roles ?? []).join(", ")}</td>
                      <td className="px-4 py-3 text-muted">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted">
              {data.total} user{data.total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="flex items-center px-2 text-sm text-muted">
                Page {page} of {totalPages}
              </span>
              <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
