import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NpatPlayClient } from "./NpatPlayClient.jsx";
import { useNpat } from "../../../../lib/npat/NpatSocketContext.jsx";

const replace = vi.fn();
const leaveRoom = vi.fn().mockResolvedValue({ ok: true });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => ({ get: (key) => (key === "code" ? "1234" : null) }),
}));

vi.mock("../../../../lib/npat/NpatSocketContext.jsx", () => ({
  useNpat: vi.fn(),
}));

vi.mock("../../../../lib/socket/useConnectionTimeout.js", () => ({
  useConnectionTimeout: () => false,
}));

vi.mock("../../../../lib/npat/useNpatFieldFeedback.js", () => ({
  useNpatFieldFeedback: () => ({ variant: null, pulseFieldComplete: vi.fn() }),
}));

vi.mock("../RoundFields.jsx", () => ({
  RoundFields: () => <div data-testid="round-fields">RoundFields</div>,
}));

vi.mock("../EarlyFinishVote.jsx", () => ({
  EarlyFinishVote: () => <div data-testid="early-finish">EarlyFinishVote</div>,
}));

vi.mock("../../../../components/feedback/GameFeedbackOverlay.jsx", () => ({
  GameFeedbackOverlay: () => null,
}));

vi.mock("../../../../components/game-feel/TimerBar.jsx", () => ({
  TimerBar: () => <div data-testid="timer-bar">TimerBar</div>,
}));

vi.mock("../NpatEvaluatingPanel.jsx", () => ({
  NpatEvaluatingPanel: () => <div data-testid="evaluating">Evaluating</div>,
}));

function baseRoom(overrides = {}) {
  return {
    code: "1234",
    state: "IN_ROUND",
    roundPhase: "collecting",
    currentRoundIndex: 0,
    currentLetter: "A",
    players: [
      { userId: "u1", username: "Host", connected: true, ready: true },
      { userId: "u2", username: "Guest", connected: true, ready: true },
    ],
    submissions: { u1: {}, u2: {} },
    ...overrides,
  };
}

describe("NpatPlayClient countdown rendering", () => {
  beforeEach(() => {
    cleanup();
    replace.mockReset();
  });

  it("shows universal countdown overlay only during STARTING", async () => {
    vi.mocked(useNpat).mockReturnValue({
      room: baseRoom({
        state: "STARTING",
        roundPhase: "none",
        startingEndsAt: Date.now() + 2000,
      }),
      connected: true,
      joinRoom: vi.fn().mockResolvedValue({ ok: true }),
      leaveRoom,
      submitField: vi.fn(),
      proposeEarlyFinish: vi.fn(),
      voteEarlyFinish: vi.fn(),
      evaluationSource: null,
      localUserId: "u1",
      socketError: null,
      clearSocketError: vi.fn(),
    });

    render(<NpatPlayClient />);
    expect(await screen.findByRole("dialog", { name: /Countdown:/i })).toBeTruthy();
  });

  it("does not show universal overlay during in-round 10s countdown", async () => {
    vi.mocked(useNpat).mockReturnValue({
      room: baseRoom({
        state: "IN_ROUND",
        roundPhase: "countdown",
        timerEndsAt: Date.now() + 8000,
        roundStartAt: Date.now() - 1000,
        countdownTriggeredByUserId: "u2",
      }),
      connected: true,
      joinRoom: vi.fn().mockResolvedValue({ ok: true }),
      leaveRoom,
      submitField: vi.fn(),
      proposeEarlyFinish: vi.fn(),
      voteEarlyFinish: vi.fn(),
      evaluationSource: null,
      localUserId: "u1",
      socketError: null,
      clearSocketError: vi.fn(),
    });

    render(<NpatPlayClient />);
    expect(await screen.findByText("Timer started")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /Countdown:/i })).toBeNull();
    expect(screen.getByTestId("timer-bar")).toBeTruthy();
  });
});

