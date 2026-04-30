"use client";

import { useState } from "react";

const TYPES = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "ui", label: "UI / UX" },
  { value: "general", label: "General" },
];

const MAX_SCREENSHOT_BYTES = 1_048_576;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function guessMimeFromName(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "";
}

/**
 * @param {File} file
 * @returns {Promise<{ name: string, mime: string, data: string }>}
 */
function readScreenshotPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      let mime = file.type && ALLOWED_MIME.has(file.type) ? file.type : "";
      if (!mime) mime = guessMimeFromName(file.name);
      if (!mime || !ALLOWED_MIME.has(mime)) {
        reject(new Error("Use a PNG, JPEG, or WebP image."));
        return;
      }
      resolve({
        name: file.name.slice(0, 200),
        mime,
        data: text,
      });
    };
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

/**
 * @param {{
 *   disabled?: boolean,
 *   onSubmit: (payload: Record<string, unknown>) => void | Promise<void>,
 *   formId?: string,
 *   onScreenshotSelectedChange?: (selected: boolean) => void,
 * }} props
 */
export function FeedbackForm({
  disabled = false,
  onSubmit,
  formId = "feedback-form",
  onScreenshotSelectedChange,
}) {
  const [type, setType] = useState("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(/** @type {File | null} */ (null));
  const [localErrors, setLocalErrors] = useState(/** @type {Record<string, string>} */ ({}));

  function setScreenshotFromInput(file) {
    setLocalErrors((prev) => {
      const next = { ...prev };
      delete next.screenshot;
      return next;
    });
    if (!file) {
      setScreenshotFile(null);
      onScreenshotSelectedChange?.(false);
      return;
    }
    const mime = file.type && ALLOWED_MIME.has(file.type) ? file.type : guessMimeFromName(file.name);
    if (!mime || !ALLOWED_MIME.has(mime)) {
      setScreenshotFile(null);
      onScreenshotSelectedChange?.(false);
      setLocalErrors((prev) => ({ ...prev, screenshot: "Please choose a PNG, JPEG, or WebP file." }));
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setScreenshotFile(null);
      onScreenshotSelectedChange?.(false);
      setLocalErrors((prev) => ({
        ...prev,
        screenshot: `Image must be at most ${Math.round(MAX_SCREENSHOT_BYTES / 1024)} KB.`,
      }));
      return;
    }
    setScreenshotFile(file);
    onScreenshotSelectedChange?.(true);
  }

  function validate() {
    /** @type {Record<string, string>} */
    const next = {};
    if (!title.trim()) next.title = "Please add a short title.";
    else if (title.trim().length > 120) next.title = "Title is too long (max 120 characters).";
    if (!description.trim()) next.description = "Please describe your feedback.";
    else if (description.length > 8000) next.description = "Description is too long (max 8000 characters).";
    if (title.trim().length + description.trim().length < 20) {
      next.description = "Please add a bit more detail (at least 20 characters between title and description).";
    }
    const em = contactEmail.trim();
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      next.contactEmail = "That doesn’t look like a valid email.";
    }
    setLocalErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (disabled) return;
    if (!validate()) return;

    const path = typeof window !== "undefined" ? window.location.pathname : "";
    /** @type {Record<string, unknown>} */
    const payload = {
      type,
      title: title.trim(),
      description: description.trim(),
      contactEmail: contactEmail.trim() ? contactEmail.trim() : null,
      website: honeypot,
      client: {
        path,
        url: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        submittedAt: new Date().toISOString(),
        platform: typeof navigator !== "undefined" ? navigator.platform : "",
        referrer: typeof document !== "undefined" ? document.referrer : "",
      },
    };

    if (screenshotFile) {
      try {
        payload.screenshot = await readScreenshotPayload(screenshotFile);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not read the image.";
        setLocalErrors((prev) => ({ ...prev, screenshot: msg }));
        return;
      }
    }

    await onSubmit(payload);
  }

  return (
    <form id={formId} onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
      <div className="sr-only" aria-hidden>
        <label htmlFor="feedback-website">Website</label>
        <input
          id="feedback-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="feedback-type" className="mb-1 block text-xs font-bold uppercase tracking-wide text-foreground/60">
          Type
        </label>
        <select
          id="feedback-type"
          value={type}
          disabled={disabled}
          onChange={(e) => setType(e.target.value)}
          className="w-full rounded-[var(--radius-lg)] border-2 border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm font-bold text-foreground shadow-sm outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(255,107,91,0.15)] disabled:opacity-60"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="feedback-title" className="mb-1 block text-xs font-bold uppercase tracking-wide text-foreground/60">
          Title
        </label>
        <input
          id="feedback-title"
          type="text"
          maxLength={140}
          disabled={disabled}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-[var(--radius-lg)] border-2 border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm font-bold text-foreground placeholder-[var(--input-placeholder)] shadow-sm outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(255,107,91,0.15)] disabled:opacity-60"
          placeholder="Short summary"
        />
        {localErrors.title ? <p className="mt-1 text-xs font-bold text-error">{localErrors.title}</p> : null}
      </div>

      <div>
        <label
          htmlFor="feedback-description"
          className="mb-1 block text-xs font-bold uppercase tracking-wide text-foreground/60"
        >
          Description
        </label>
        <textarea
          id="feedback-description"
          rows={5}
          maxLength={8200}
          disabled={disabled}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full resize-y rounded-[var(--radius-lg)] border-2 border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm font-medium text-foreground placeholder-[var(--input-placeholder)] shadow-sm outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(255,107,91,0.15)] disabled:opacity-60"
          placeholder="What happened? What did you expect?"
        />
        {localErrors.description ? (
          <p className="mt-1 text-xs font-bold text-error">{localErrors.description}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="feedback-screenshot"
          className="mb-1 block text-xs font-bold uppercase tracking-wide text-foreground/60"
        >
          Screenshot <span className="font-medium normal-case text-foreground/60">(optional, max 1 MB)</span>
        </label>
        <input
          id="feedback-screenshot"
          type="file"
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          disabled={disabled}
          className="w-full text-sm font-medium text-foreground file:mr-3 file:rounded-[var(--radius-lg)] file:border-0 file:bg-primary/15 file:px-4 file:py-2 file:text-sm file:font-bold file:text-primary disabled:opacity-60"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setScreenshotFromInput(f ?? null);
            e.target.value = "";
          }}
        />
        {screenshotFile ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-foreground/60">
              Selected: <span className="font-mono text-foreground/70">{screenshotFile.name}</span>
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setScreenshotFromInput(null)}
              className="text-xs font-bold text-primary underline-offset-2 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ) : null}
        {localErrors.screenshot ? <p className="mt-1 text-xs font-bold text-error">{localErrors.screenshot}</p> : null}
      </div>

      <div>
        <label
          htmlFor="feedback-email"
          className="mb-1 block text-xs font-bold uppercase tracking-wide text-foreground/60"
        >
          Contact email <span className="font-medium normal-case text-foreground/60">(optional)</span>
        </label>
        <input
          id="feedback-email"
          type="email"
          autoComplete="email"
          disabled={disabled}
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="w-full rounded-[var(--radius-lg)] border-2 border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-3 text-sm font-bold text-foreground placeholder-[var(--input-placeholder)] shadow-sm outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(255,107,91,0.15)] disabled:opacity-60"
          placeholder="you@example.com"
        />
        {localErrors.contactEmail ? (
          <p className="mt-1 text-xs font-bold text-error">{localErrors.contactEmail}</p>
        ) : null}
      </div>
    </form>
  );
}
