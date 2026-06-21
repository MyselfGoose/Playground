"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "../../../lib/api.js";

const CATEGORIES = [
  "science", "history", "pop-culture", "weird", "sports",
  "geography", "food", "animals", "language", "technology",
];

function PromptForm({ initial, onSave, onCancel }) {
  const [text, setText] = useState(initial?.text ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 2);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ text, answer, category, difficulty });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-muted-bright/40 bg-background p-6">
      <div>
        <label className="mb-1 block text-sm font-bold">Prompt text (use ______ for blank)</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          required
          className="w-full rounded-xl border border-muted-bright/40 bg-transparent px-4 py-3 text-sm"
          placeholder="The official state sport of Maryland is ______."
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-bold">Answer</label>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
            className="w-full rounded-xl border border-muted-bright/40 bg-transparent px-4 py-2 text-sm"
            placeholder="jousting"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-muted-bright/40 bg-transparent px-4 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold">Difficulty (1-3)</label>
          <input
            type="number"
            min={1}
            max={3}
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="w-full rounded-xl border border-muted-bright/40 bg-transparent px-4 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary/90 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary disabled:opacity-50"
        >
          {saving ? "Saving..." : initial ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-muted-bright/40 px-5 py-2 text-sm font-bold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminFibbagePage() {
  const [prompts, setPrompts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const limit = 25;

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) qs.set("q", search);
      if (catFilter) qs.set("category", catFilter);
      const res = await apiFetch(`/api/v1/admin/fibbage/prompts?${qs}`);
      setPrompts(res.data?.prompts ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  }, [page, search, catFilter]);

  useEffect(() => {
    void fetchPrompts();
  }, [fetchPrompts]);

  async function handleCreate(data) {
    await apiFetch("/api/v1/admin/fibbage/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowCreate(false);
    await fetchPrompts();
  }

  async function handleUpdate(id, data) {
    await apiFetch(`/api/v1/admin/fibbage/prompts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditingId(null);
    await fetchPrompts();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this prompt permanently?")) return;
    await apiFetch(`/api/v1/admin/fibbage/prompts/${id}`, { method: "DELETE" });
    await fetchPrompts();
  }

  async function handleToggleActive(prompt) {
    await apiFetch(`/api/v1/admin/fibbage/prompts/${prompt._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !prompt.active }),
    });
    await fetchPrompts();
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Fibbage Prompts</h1>
        <button
          onClick={() => { setShowCreate(true); setEditingId(null); }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary/90 px-4 py-2 text-sm font-bold text-white hover:bg-primary"
        >
          <Plus className="h-4 w-4" /> Add prompt
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search prompts..."
            className="w-full rounded-xl border border-muted-bright/40 bg-transparent py-2 pl-10 pr-4 text-sm"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-muted-bright/40 bg-transparent px-4 py-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {showCreate && (
        <PromptForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Loading prompts...</p>
      ) : prompts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No prompts found.</p>
      ) : (
        <div className="space-y-3">
          {prompts.map((p) => (
            <div key={p._id}>
              {editingId === p._id ? (
                <PromptForm
                  initial={p}
                  onSave={(data) => handleUpdate(p._id, data)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-start gap-4 rounded-2xl border border-muted-bright/30 p-4 transition-colors hover:border-muted-bright/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-relaxed">{p.text}</p>
                    <p className="mt-1 text-xs text-muted">
                      <span className="font-bold text-primary">{p.answer}</span>
                      {" · "}
                      <span className="capitalize">{p.category}</span>
                      {" · D"}
                      {p.difficulty}
                      {!p.active && (
                        <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-xs font-bold text-red-400">
                          Disabled
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => handleToggleActive(p)}
                      className="rounded-lg border border-muted-bright/40 px-2.5 py-1 text-xs font-bold"
                      title={p.active ? "Disable" : "Enable"}
                    >
                      {p.active ? "Disable" : "Enable"}
                    </button>
                    <button
                      onClick={() => { setEditingId(p._id); setShowCreate(false); }}
                      className="rounded-lg border border-muted-bright/40 p-1.5"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(p._id)}
                      className="rounded-lg border border-red-500/40 p-1.5 text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-muted-bright/40 p-2 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted">
            Page {page} of {totalPages} ({total} prompts)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-muted-bright/40 p-2 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
