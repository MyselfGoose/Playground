#!/usr/bin/env node
/**
 * Smoke check for same-origin API proxy + socket admission path.
 * Usage (local): API_PROXY_TARGET=http://localhost:4000 FRONTEND_URL=http://localhost:3000 node scripts/smoke-auth-proxy.mjs
 */
import assert from "node:assert/strict";

const apiTarget = (process.env.API_PROXY_TARGET ?? process.env.BACKEND_URL ?? "http://localhost:4000")
  .replace(/\/+$/, "");
const frontendUrl = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const strongPassword = "SmokeTest123!@#";
const email = `smoke_${Date.now()}@example.com`;
const username = `smoke${Date.now()}`;

async function main() {
  const registerRes = await fetch(`${apiTarget}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: frontendUrl },
    credentials: "include",
    body: JSON.stringify({ username, email, password: strongPassword }),
  });
  assert.equal(registerRes.status, 201, `register failed: ${await registerRes.text()}`);

  const setCookie = registerRes.headers.getSetCookie?.() ?? [];
  assert.ok(setCookie.length >= 1, "expected Set-Cookie from register");

  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
  const meRes = await fetch(`${apiTarget}/api/v1/auth/me`, {
    headers: { Cookie: cookieHeader, Origin: frontendUrl },
  });
  assert.equal(meRes.status, 200, `me failed: ${await meRes.text()}`);

  const admissionRes = await fetch(`${apiTarget}/api/v1/auth/socket-admission`, {
    headers: { Cookie: cookieHeader, Origin: frontendUrl },
  });
  assert.equal(admissionRes.status, 200, `socket-admission failed: ${await admissionRes.text()}`);
  const admissionJson = await admissionRes.json();
  assert.ok(admissionJson?.data?.token, "missing admission token");

  console.log("smoke-auth-proxy: OK (register → me → socket-admission)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
