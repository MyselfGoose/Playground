"use client";

import { Card } from "../ui/Card.jsx";

/**
 * @param {{ title: string; subtitle?: string; children: import('react').ReactNode; className?: string }} props
 */
export function ProfileSection({ title, subtitle, children, className = "" }) {
  return (
    <section className={className}>
      <Card variant="elevated" className="border border-muted-bright/50 bg-background/90 p-6 shadow-[var(--shadow-card)] backdrop-blur-sm sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight text-foreground">{title}</h2>
            {subtitle ? <p className="mt-1.5 text-sm font-semibold text-foreground/65">{subtitle}</p> : null}
          </div>
        </div>
        <div className="mt-5">{children}</div>
      </Card>
    </section>
  );
}
