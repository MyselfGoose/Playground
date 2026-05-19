"use client";

import Link from "next/link";

/**
 * @param {{
 *   title: string,
 *   message: string,
 *   actions?: Array<{ label: string, onClick?: () => void, href?: string }>,
 * }} props
 */
export function ErrorState({ title, message, actions = [] }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-3 text-sm text-muted">{message}</p>
      {actions.length > 0 ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {actions.map((action) =>
            action.href ? (
              <Link
                key={action.label}
                href={action.href}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                {action.label}
              </Link>
            ) : (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
