import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeProxyTarget } from "./next.config.mjs";

describe("normalizeProxyTarget", () => {
  it("adds https when scheme is missing", () => {
    assert.equal(
      normalizeProxyTarget("playground-production-d732.up.railway.app"),
      "https://playground-production-d732.up.railway.app",
    );
  });

  it("preserves https and strips trailing slash", () => {
    assert.equal(
      normalizeProxyTarget("https://api.example.com/"),
      "https://api.example.com",
    );
  });

  it("returns empty for blank input", () => {
    assert.equal(normalizeProxyTarget(""), "");
    assert.equal(normalizeProxyTarget(undefined), "");
  });
});
