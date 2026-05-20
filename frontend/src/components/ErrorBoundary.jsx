"use client";

import { Component } from "react";

/**
 * Catch-all React error boundary. Prevents a single component crash from
 * tearing down the entire React tree. Renders a recoverable fallback UI
 * so users can retry or navigate away without a hard browser refresh.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const onError = this.props.onError;
    if (typeof onError === "function") {
      try {
        onError(error, errorInfo);
      } catch {
        // Swallow errors in the reporter itself.
      }
    }
    if (typeof window !== "undefined" && typeof window.__PLAYGROUNDS_REPORT_ERROR__ === "function") {
      try {
        window.__PLAYGROUNDS_REPORT_ERROR__(error, errorInfo);
      } catch {
        // noop
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
        });
      }

      return <DefaultErrorFallback error={this.state.error} reset={this.handleReset} level={this.props.level} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, reset, level }) {
  const isGame = level === "game";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/40 max-w-md w-full">
        <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">
          {isGame ? "Something hiccuped in this game" : "That didn't work"}
        </h2>
        <p className="text-sm text-red-600/80 dark:text-red-300/80 mb-4">
          {isGame
            ? "Your progress on the server is safe — try again or head back to the games hub."
            : "Give it another try, or head back to the home page."}
        </p>
        {error?.message && process.env.NODE_ENV !== "production" && (
          <pre className="mb-4 max-h-32 overflow-auto rounded bg-red-100 p-2 text-left text-xs text-red-800 dark:bg-red-900/40 dark:text-red-200">
            {error.message}
          </pre>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {isGame ? (
            <a
              href="/games"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              Leave to games hub
            </a>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isGame
                ? "border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-lg border border-red-200 dark:border-red-700 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
