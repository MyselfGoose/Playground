"use client";

/**
 * @param {{
 *   kind: 'accept' | 'decline' | 'cancel' | 'resend',
 *   label: string,
 *   disabled?: boolean,
 *   onClick: () => void,
 * }} props
 */
export function FriendIconButton({ kind, label, disabled, onClick }) {
  const styles = {
    accept:
      "bg-accent-mint/20 text-accent-mint ring-accent-mint/30 hover:bg-accent-mint/30 focus-visible:outline-accent-mint",
    decline:
      "bg-error/10 text-error ring-error/25 hover:bg-error/20 focus-visible:outline-error",
    cancel:
      "bg-muted-bright/40 text-muted ring-foreground/15 hover:bg-muted-bright/70 hover:text-foreground focus-visible:outline-primary",
    resend:
      "bg-muted-bright/40 text-foreground ring-foreground/15 hover:bg-muted-bright/70 focus-visible:outline-primary",
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 disabled:opacity-50 ${styles[kind]}`}
    >
      {kind === "accept" ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : kind === "decline" || kind === "cancel" ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
          <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M11.5 2.5v3M11.5 10.5v3M4.5 4.5h6a2 2 0 0 1 0 4h-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
