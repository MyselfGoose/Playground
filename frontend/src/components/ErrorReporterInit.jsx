"use client";

import { useEffect } from "react";
import { initErrorReporting } from "../lib/errorReporting.js";

export function ErrorReporterInit() {
  useEffect(() => {
    initErrorReporting();
  }, []);
  return null;
}
