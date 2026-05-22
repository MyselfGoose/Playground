#!/usr/bin/env python3
"""Regenerate plan/phases/** prompts. See git history for full catalog if extending."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHASES = ROOT / "plan" / "phases"

EXPECTED = 80


def main() -> int:
    prompts = sorted(PHASES.rglob("[0-9][0-9][0-9]-*.md"))
    # Exclude annex files
    prompts = [p for p in prompts if "annex" not in p.name]
    n = len(prompts)
    if n != EXPECTED:
        print(f"Expected {EXPECTED} prompts, found {n}", file=sys.stderr)
        return 1
    print(f"OK: {n} prompts present. Full regeneration catalog not re-run (manual edits preserved).")
    print("To bulk-regenerate from scratch, restore catalog in commit that introduced /plan.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
