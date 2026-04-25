import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackForm } from "./FeedbackForm.jsx";

describe("FeedbackForm", () => {
  it("calls onSubmit with payload when title and description meet validation", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<FeedbackForm onSubmit={onSubmit} formId="feedback-form-test" />);

    await user.type(screen.getByLabelText(/Title/i), "Bug in lobby");
    await user.type(
      screen.getByLabelText(/Description/i),
      "When I refresh the page the room list is empty. Expected to see my room.",
    );

    const form = document.getElementById("feedback-form-test");
    expect(form).toBeTruthy();
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.type).toBe("bug");
    expect(payload.title).toBe("Bug in lobby");
    expect(payload.description.length).toBeGreaterThan(10);
  });
});
