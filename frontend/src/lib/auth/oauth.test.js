import test from "node:test";
import assert from "node:assert/strict";

test("googleSignInHref uses socket base not relative api path", async () => {
  const prevSocket = process.env.NEXT_PUBLIC_SOCKET_URL;
  const prevSameOrigin = process.env.NEXT_PUBLIC_SAME_ORIGIN_API;
  process.env.NEXT_PUBLIC_SAME_ORIGIN_API = "1";
  process.env.NEXT_PUBLIC_SOCKET_URL = "https://api.example.railway.app";
  const { googleSignInHref } = await import(`./oauth.js?oauthTest=${Date.now()}`);
  const href = googleSignInHref("/games");
  assert.match(href, /^https:\/\/api\.example\.railway\.app\/api\/v1\/auth\/google\?/);
  assert.ok(href.includes("next=%2Fgames"));
  if (prevSocket === undefined) delete process.env.NEXT_PUBLIC_SOCKET_URL;
  else process.env.NEXT_PUBLIC_SOCKET_URL = prevSocket;
  if (prevSameOrigin === undefined) delete process.env.NEXT_PUBLIC_SAME_ORIGIN_API;
  else process.env.NEXT_PUBLIC_SAME_ORIGIN_API = prevSameOrigin;
});

test("googleSignInHref falls back to same-origin proxy when socket URL unset", async () => {
  const prevSocket = process.env.NEXT_PUBLIC_SOCKET_URL;
  const prevSameOrigin = process.env.NEXT_PUBLIC_SAME_ORIGIN_API;
  const prevApi = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_SAME_ORIGIN_API = "1";
  delete process.env.NEXT_PUBLIC_SOCKET_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
  const { googleSignInHref } = await import(`./oauth.js?oauthSameOrigin=${Date.now()}`);
  const href = googleSignInHref("/register");
  assert.equal(href, "/api/v1/auth/google?next=%2Fregister");
  if (prevSocket === undefined) delete process.env.NEXT_PUBLIC_SOCKET_URL;
  else process.env.NEXT_PUBLIC_SOCKET_URL = prevSocket;
  if (prevSameOrigin === undefined) delete process.env.NEXT_PUBLIC_SAME_ORIGIN_API;
  else process.env.NEXT_PUBLIC_SAME_ORIGIN_API = prevSameOrigin;
  if (prevApi === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = prevApi;
});

test("safeNextPath blocks open redirects", async () => {
  const { safeNextPath } = await import(`./oauth.js?safeNext=${Date.now()}`);
  assert.equal(safeNextPath("/games"), "/games");
  assert.equal(safeNextPath("//evil.com"), "/");
  assert.equal(safeNextPath("https://evil.com"), "/");
});
