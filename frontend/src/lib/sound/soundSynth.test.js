import { describe, expect, it, vi } from "vitest";
import { playSuccessChime, SYNTH_BY_EVENT } from "./soundSynth.js";

describe("soundSynth", () => {
  it("maps success event to chime player", () => {
    expect(SYNTH_BY_EVENT.success).toBe(playSuccessChime);
  });

  it("playSuccessChime does not throw without AudioContext", () => {
    expect(() => playSuccessChime()).not.toThrow();
  });

  it("playSuccessChime schedules oscillators when AudioContext exists", () => {
    const start = vi.fn();
    const stop = vi.fn();
    const connect = vi.fn();
    const createOscillator = vi.fn(() => ({
      type: "sine",
      frequency: { value: 0 },
      connect,
      start,
      stop,
    }));
    const createGain = vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect,
    }));

    class MockAudioContext {
      constructor() {
        this.currentTime = 0;
        this.destination = {};
      }
      resume() {
        return Promise.resolve();
      }
      createOscillator = createOscillator;
      createGain = createGain;
    }

    vi.stubGlobal("AudioContext", MockAudioContext);
    vi.stubGlobal("webkitAudioContext", undefined);

    playSuccessChime();

    expect(createOscillator).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();
  });
});
