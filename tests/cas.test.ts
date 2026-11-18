import assert from "node:assert/strict";
import test from "node:test";
import { casCallbackUrl, casLoginUrl, casLogoutUrl, netidToYaleEmail, parseCasNetid } from "../lib/cas.ts";

const success = `<?xml version="1.0"?>
<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationSuccess>
    <cas:user>ada12</cas:user>
  </cas:authenticationSuccess>
</cas:serviceResponse>`;

const failure = `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationFailure code="INVALID_TICKET">Ticket not recognized</cas:authenticationFailure>
</cas:serviceResponse>`;

test("reads the NetID from a successful CAS response", () => {
  assert.equal(parseCasNetid(success), "ada12");
  assert.equal(netidToYaleEmail("Ada12"), "ada12@yale.edu");
});

test("rejects a failed ticket, a missing user, and a NetID that is not an address label", () => {
  assert.equal(parseCasNetid(failure), null);
  assert.equal(parseCasNetid("<cas:authenticationSuccess></cas:authenticationSuccess>"), null);
  assert.equal(parseCasNetid(`${success}<cas:authenticationFailure code="INVALID_TICKET">no</cas:authenticationFailure>`), null);
  for (const netid of ["", "a", "ada@yale.edu", "ada.name", "../ada", "ada 12", "x".repeat(40)]) {
    assert.equal(netidToYaleEmail(netid), null, netid);
  }
});

test("builds the Yale login and logout URLs with the same callback", () => {
  const origin = "http://localhost:3000";
  const callback = casCallbackUrl(origin);
  assert.equal(callback, "http://localhost:3000/auth/cas/callback");
  assert.equal(
    casLoginUrl(origin),
    `https://secure.its.yale.edu/cas/login?service=${encodeURIComponent(callback)}`,
  );
  assert.equal(casLogoutUrl(origin), `https://secure.its.yale.edu/cas/logout?service=${encodeURIComponent(origin)}`);
  assert.equal(casLogoutUrl(null), "https://secure.its.yale.edu/cas/logout");
});
