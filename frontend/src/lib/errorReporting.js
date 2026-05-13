/**
 * Lightweight client-side error reporting.
 *
 * Captures uncaught errors, unhandled rejections, and errors forwarded
 * from React Error Boundaries via `window.__PLAYGROUNDS_REPORT_ERROR__`.
 *
 * Configure by setting `NEXT_PUBLIC_ERROR_REPORTING_DSN` to a Sentry-compatible
 * DSN, or omit it to use console-only reporting in development.
 *
 * Call `initErrorReporting()` once during app bootstrap (root layout).
 */

const MAX_BREADCRUMBS = 20;
const REPORT_ENDPOINT = "/api/v1/client-errors";

/** @type {{ ts: number, type: string, message: string }[]} */
const breadcrumbs = [];

let initialized = false;

function addBreadcrumb(type, message) {
  breadcrumbs.push({ ts: Date.now(), type, message: String(message).slice(0, 200) });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

function buildReport(error, extra) {
  return {
    message: error?.message ?? String(error),
    stack: error?.stack?.slice(0, 4000),
    url: typeof location !== "undefined" ? location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    timestamp: new Date().toISOString(),
    breadcrumbs: [...breadcrumbs],
    ...extra,
  };
}

function sendReport(report) {
  const dsn = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ERROR_REPORTING_DSN : "";

  if (dsn) {
    try {
      if (typeof window !== "undefined" && window.Sentry?.captureException) {
        window.Sentry.captureException(
          report.originalError ?? new Error(report.message),
          { extra: report },
        );
        return;
      }
    } catch {
      // fall through to beacon
    }
  }

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(REPORT_ENDPOINT, JSON.stringify(report));
      return;
    } catch {
      // fall through to console
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.error("[ErrorReporting]", report);
  }
}

/**
 * Initialize global error listeners. Safe to call multiple times.
 */
export function initErrorReporting() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  window.addEventListener("error", (event) => {
    addBreadcrumb("uncaught", event.message);
    sendReport(buildReport(event.error ?? event.message, { source: "window.onerror" }));
  });

  window.addEventListener("unhandledrejection", (event) => {
    const err = event.reason;
    addBreadcrumb("unhandledrejection", err?.message ?? String(err));
    sendReport(buildReport(err, { source: "unhandledrejection" }));
  });

  window.__PLAYGROUNDS_REPORT_ERROR__ = (error, errorInfo) => {
    addBreadcrumb("error_boundary", error?.message ?? "unknown");
    sendReport(
      buildReport(error, {
        source: "ErrorBoundary",
        componentStack: errorInfo?.componentStack?.slice(0, 4000),
        originalError: error,
      }),
    );
  };

  addBreadcrumb("init", "error reporting initialized");
}

export { addBreadcrumb };
