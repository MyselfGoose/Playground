import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { useFocusTrap } from "./useFocusTrap.js";

describe("useFocusTrap", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("focuses first focusable element when active", async () => {
    const container = document.createElement("div");
    const btn1 = document.createElement("button");
    btn1.textContent = "One";
    const btn2 = document.createElement("button");
    btn2.textContent = "Two";
    container.append(btn1, btn2);
    document.body.append(container);

    const { result } = renderHook(() => {
      const ref = useRef(container);
      useFocusTrap(true, ref);
      return ref;
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(btn1);
    });
    expect(result.current.current).toBe(container);
  });

  it("calls onEscape when Escape is pressed", () => {
    const container = document.createElement("div");
    const btn = document.createElement("button");
    container.append(btn);
    document.body.append(container);

    const onEscape = vi.fn();
    renderHook(() => {
      const ref = useRef(container);
      useFocusTrap(true, ref, { onEscape });
    });

    container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
