"use client";

import { useCallback, useState } from "react";
import { ApiError, apiFetch } from "../lib/api.js";

/**
 * @typedef {'idle' | 'submitting' | 'success' | 'error'} FeedbackSubmitPhase
 */

export function useFeedbackSubmit() {
  const [phase, setPhase] = useState(/** @type {FeedbackSubmitPhase} */ ("idle"));
  const [errorMessage, setErrorMessage] = useState("");
  const [issueUrl, setIssueUrl] = useState(/** @type {string | null} */ (null));
  const [issueNumber, setIssueNumber] = useState(/** @type {number | null} */ (null));

  const reset = useCallback(() => {
    setPhase("idle");
    setErrorMessage("");
    setIssueUrl(null);
    setIssueNumber(null);
  }, []);

  const submit = useCallback(async (payload) => {
    setPhase("submitting");
    setErrorMessage("");
    try {
      const json = await apiFetch("/api/v1/feedback", {
        method: "POST",
        body: JSON.stringify(payload),
        noAutoRefresh: true,
      });
      const data = json && typeof json === "object" && json !== null && "data" in json ? json.data : null;
      const url =
        data && typeof data === "object" && data !== null && "issueUrl" in data
          ? String(data.issueUrl)
          : "";
      const num =
        data && typeof data === "object" && data !== null && "issueNumber" in data
          ? Number(data.issueNumber)
          : NaN;
      if (!url) {
        throw new Error("Unexpected response from server.");
      }
      setIssueUrl(url);
      setIssueNumber(Number.isFinite(num) ? num : null);
      setPhase("success");
    } catch (err) {
      setPhase("error");
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setErrorMessage("Too many submissions. Please try again in a few minutes.");
        } else if (err.status === 503) {
          setErrorMessage(err.message || "Feedback is temporarily unavailable.");
        } else {
          setErrorMessage(err.message || "Something went wrong.");
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Something went wrong.");
      }
    }
  }, []);

  return { submit, reset, phase, errorMessage, issueUrl, issueNumber };
}
