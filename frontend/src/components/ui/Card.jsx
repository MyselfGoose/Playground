"use client";

const variants = {
  default: "bg-background ring-1 ring-muted-bright/50 shadow-sm",
  elevated: "bg-background shadow-[var(--shadow-md)] ring-2 ring-muted-bright/40",
  game: "bg-background/80 backdrop-blur-sm shadow-[var(--shadow-md)] ring-2 ring-muted-bright/40",
};

export function Card({ variant = "default", className = "", children, ...props }) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] p-6 ${variants[variant] ?? variants.default} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
