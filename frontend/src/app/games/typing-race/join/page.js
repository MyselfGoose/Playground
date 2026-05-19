"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { normalizePartyCode } from "../../../../lib/party/buildInviteUrl.js";

export default function TypingRaceJoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const digits = normalizePartyCode(searchParams.get("code") ?? "")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (digits.length === 6) {
      router.replace(`/games/typing-race/multi/room/${digits}`);
      return;
    }
    router.replace("/games/typing-race/multi");
  }, [router, searchParams]);

  return (
    <div className="mx-auto flex min-h-[40vh] w-full max-w-2xl flex-1 items-center justify-center px-4 py-16 text-center text-[var(--tt-ink-muted)]">
      Redirecting…
    </div>
  );
}
