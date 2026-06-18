"use client";

export function TabooAmbientBackground() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 bg-taboo-canvas" />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% -5%, rgba(91, 159, 212, 0.14) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 50% 100%, rgba(255, 125, 112, 0.08) 0%, transparent 55%)",
        }}
      />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[420px] w-[520px] -translate-x-1/2 rounded-full bg-taboo-team-a/15 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-1/4 h-[320px] w-[420px] rounded-full bg-taboo-team-b/10 blur-[100px]" />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 35%, rgba(15, 14, 13, 0.7) 100%)",
        }}
      />
    </>
  );
}
