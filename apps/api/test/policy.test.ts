import assert from "node:assert/strict";
import { test } from "node:test";
import { isActorId, parseCookie } from "../src/cookies.js";
import { hasMagicBytes } from "../src/file-signature.js";
import { canTransitionIncident, severityForReport } from "../src/incident-rules.js";
import { cacheControlFor, mediaVisibility } from "../src/media-policy.js";

const media = (audience: string, status: string, userId = "owner-1") => ({ audience, status, userId });
const anon = { actorId: null, isStaff: false };
const staff = { actorId: null, isStaff: true };

// ---- Media visibility (F-02, F-16) ----

test("only APPROVED community media is public", () => {
  assert.equal(mediaVisibility(media("community", "APPROVED"), anon), "public");
  assert.equal(mediaVisibility(media("community", "PROCESSING"), anon), null);
  assert.equal(mediaVisibility(media("community", "REJECTED"), anon), null);
});

test("moderators can preview pending and rejected community clips", () => {
  assert.equal(mediaVisibility(media("community", "PROCESSING"), staff), "staff");
  assert.equal(mediaVisibility(media("community", "REJECTED"), staff), "staff");
});

test("me media is owner-only, even for staff", () => {
  assert.equal(mediaVisibility(media("me", "PROCESSING"), { actorId: "owner-1", isStaff: false }), "owner");
  assert.equal(mediaVisibility(media("me", "PROCESSING"), { actorId: "someone-else", isStaff: false }), null);
  assert.equal(mediaVisibility(media("me", "APPROVED"), { actorId: "owner-1", isStaff: true }), "owner");
  assert.equal(mediaVisibility(media("me", "APPROVED"), staff), null);
});

test("security media is staff-only", () => {
  assert.equal(mediaVisibility(media("security", "PROCESSING"), anon), null);
  assert.equal(mediaVisibility(media("security", "PROCESSING"), staff), "staff");
});

test("only public media gets a public cache header", () => {
  assert.equal(cacheControlFor("public"), "public, max-age=300");
  assert.equal(cacheControlFor("owner"), "private, no-store");
  assert.equal(cacheControlFor("staff"), "private, no-store");
});

// ---- Incident state machine (SOS console) ----

test("incident transitions follow the state machine", () => {
  assert.equal(canTransitionIncident("OPEN", "ACKNOWLEDGED"), true);
  assert.equal(canTransitionIncident("OPEN", "RESOLVED"), true);
  assert.equal(canTransitionIncident("ACKNOWLEDGED", "ASSIGNED"), true);
  assert.equal(canTransitionIncident("RESOLVED", "ACKNOWLEDGED"), false);
  assert.equal(canTransitionIncident("FALSE_POSITIVE", "OPEN"), true);
  assert.equal(canTransitionIncident("RESOLVED", "FALSE_POSITIVE"), false);
});

test("unknown incident statuses never transition", () => {
  assert.equal(canTransitionIncident("BOGUS", "OPEN"), false);
  assert.equal(canTransitionIncident("OPEN", "BOGUS"), false);
});

test("rule-based severity is critical for medical and fire", () => {
  assert.equal(severityForReport("MEDICAL"), "CRITICAL");
  assert.equal(severityForReport("FIRE"), "CRITICAL");
  assert.equal(severityForReport("SECURITY"), "MEDIUM");
  assert.equal(severityForReport("OTHER"), "MEDIUM");
});

// ---- Guest identity cookies ----

test("parseCookie finds the named cookie", () => {
  assert.equal(parseCookie("a=1; roar_actor=abc-123; b=2", "roar_actor"), "abc-123");
  assert.equal(parseCookie("roar_actor=hello%20world", "roar_actor"), "hello world");
  assert.equal(parseCookie("other=1", "roar_actor"), null);
  assert.equal(parseCookie(undefined, "roar_actor"), null);
});

test("parseCookie rejects malformed encoding instead of throwing", () => {
  assert.equal(parseCookie("roar_actor=%E0%A4%A", "roar_actor"), null);
});

test("isActorId accepts UUIDs and rejects anything else", () => {
  assert.equal(isActorId("f47ac10b-58cc-4372-a567-0e02b2c3d479"), true);
  assert.equal(isActorId("F47AC10B-58CC-4372-A567-0E02B2C3D479"), true);
  assert.equal(isActorId("short"), false);
  assert.equal(isActorId(null), false);
  assert.equal(isActorId("f47ac10b-58cc-4372-a567-0e02b2c3d479; DROP TABLE"), false);
});

// ---- Upload magic bytes ----

const bytes = (...values: number[]) => Buffer.from(values);

test("declared media types must match their file signature", () => {
  assert.equal(hasMagicBytes(bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg"), true);
  assert.equal(hasMagicBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/png"), true);
  assert.equal(hasMagicBytes(Buffer.from("GIF89a"), "image/gif"), true);
  assert.equal(hasMagicBytes(Buffer.from("RIFF0000WEBP"), "image/webp"), true);
  assert.equal(hasMagicBytes(Buffer.from("0000ftyp"), "video/mp4"), true);
  assert.equal(hasMagicBytes(bytes(0x1a, 0x45, 0xdf, 0xa3), "video/webm"), true);
});

test("an HTML payload cannot masquerade as media", () => {
  const html = Buffer.from("<html><script>alert(1)</script></html>");
  for (const mimetype of ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"]) {
    assert.equal(hasMagicBytes(html, mimetype), false, mimetype);
  }
  assert.equal(hasMagicBytes(html, "text/html"), false);
});
