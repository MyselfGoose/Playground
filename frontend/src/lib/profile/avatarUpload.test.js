import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  avatarSourceRejectionMessage,
  isAcceptedAvatarSourceFile,
  MAX_AVATAR_SOURCE_BYTES,
} from "./avatarUpload.js";

describe("isAcceptedAvatarSourceFile", () => {
  it("accepts standard MIME types", () => {
    assert.equal(isAcceptedAvatarSourceFile({ type: "image/jpeg", name: "photo.jpg" }), true);
    assert.equal(isAcceptedAvatarSourceFile({ type: "image/png", name: "photo.png" }), true);
    assert.equal(isAcceptedAvatarSourceFile({ type: "image/webp", name: "photo.webp" }), true);
  });

  it("accepts HEIC from iOS", () => {
    assert.equal(isAcceptedAvatarSourceFile({ type: "image/heic", name: "IMG_0001.HEIC" }), true);
    assert.equal(isAcceptedAvatarSourceFile({ type: "", name: "IMG_0001.heic" }), true);
  });

  it("accepts generic image/* when browser sends it", () => {
    assert.equal(isAcceptedAvatarSourceFile({ type: "image/jpg", name: "x" }), true);
  });

  it("rejects non-images", () => {
    assert.equal(isAcceptedAvatarSourceFile({ type: "application/pdf", name: "doc.pdf" }), false);
    assert.equal(isAcceptedAvatarSourceFile({ type: "", name: "notes.txt" }), false);
  });
});

describe("avatarSourceRejectionMessage", () => {
  it("returns null for valid files", () => {
    assert.equal(
      avatarSourceRejectionMessage({ type: "image/jpeg", name: "a.jpg", size: 1024 }),
      null,
    );
  });

  it("rejects oversized files", () => {
    const msg = avatarSourceRejectionMessage({
      type: "image/jpeg",
      name: "big.jpg",
      size: MAX_AVATAR_SOURCE_BYTES + 1,
    });
    assert.match(msg ?? "", /12 MB/);
  });
});
