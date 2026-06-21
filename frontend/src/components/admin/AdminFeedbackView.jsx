"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { fetchAdminFeedback } from "../../lib/admin/api.js";
import { Card } from "../ui/Card.jsx";
import { Badge } from "../ui/Badge.jsx";
import { Button } from "../Button.jsx";
import { LoadingSkeleton } from "../LoadingSkeleton.jsx";

export function AdminFeedbackView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdminFeedback({ page, state: "open" })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load feedback");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Feedback queue</h1>
        <p className="mt-1 text-sm text-muted">Open GitHub issues from user feedback</p>
      </div>

      {loading && !data ? <LoadingSkeleton variant="card" /> : null}
      {error ? (
        <Card>
          <p className="text-error">{error}</p>
          <p className="mt-2 text-sm text-muted">Ensure GITHUB_TOKEN and repo settings are configured on the backend.</p>
        </Card>
      ) : null}

      {data ? (
        <div className="space-y-3">
          {data.issues.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">No open feedback issues</p>
            </Card>
          ) : (
            data.issues.map((issue) => (
              <Card key={issue.number} className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      #{issue.number} {issue.title}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {issue.createdAt ? new Date(issue.createdAt).toLocaleString() : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={issue.state === "open" ? "primary" : "neutral"}>{issue.state}</Badge>
                      {(issue.labels ?? []).map((l) => (
                        <Badge key={l} tone="neutral">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {issue.htmlUrl ? (
                    <a href={issue.htmlUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" type="button">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </Button>
                    </a>
                  ) : null}
                </div>
              </Card>
            ))
          )}

          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="ghost" onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
