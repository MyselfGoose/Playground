#!/usr/bin/env node
/**
 * Lighthouse CI stub — documents performance budgets until LHCI is configured.
 * Exit 0 so CI can call this without failing.
 */

const BASE = process.env.LIGHTHOUSE_BASE_URL ?? "http://localhost:3000";

const budgets = [
  { route: "/", lcp: "< 2.5s", cls: "< 0.1" },
  { route: "/games", lcp: "< 2.5s", cls: "< 0.1" },
];

console.log("Playground Lighthouse stub (performance-budgets.md)\n");
console.log("Targets:");
for (const b of budgets) {
  console.log(`  ${b.route}  LCP ${b.lcp}  CLS ${b.cls}`);
}

console.log("\nExample commands (dev server must be running):\n");
for (const b of budgets) {
  const url = `${BASE}${b.route === "/" ? "" : b.route}`;
  console.log(`  npx lighthouse ${url} --only-categories=performance --chrome-flags="--headless"`);
}

console.log("\nRecord LCP and CLS in your PR. Full budgets: performance-budgets.md\n");
