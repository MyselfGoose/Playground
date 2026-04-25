import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeApiBase } from "./api.js";

describe("normalizeApiBase", () => {
  it("strips trailing /api/v1", () => {
    assert.equal(normalizeApiBase("https://api.example.com/api/v1"), "https://api.example.com");
  });

  it("strips trailing /api", () => {
    assert.equal(normalizeApiBase("http://localhost:4000/api"), "http://localhost:4000");
  });

  it("trims slashes", () => {
    assert.equal(normalizeApiBase("http://host///"), "http://host");
  });
});
