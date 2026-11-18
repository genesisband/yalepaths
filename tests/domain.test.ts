import assert from "node:assert/strict";
import test from "node:test";
import { isYaleEmail } from "../lib/domain.ts";

test("accepts the exact yale.edu domain", () => {
  assert.equal(isYaleEmail("ada@yale.edu"), true);
  assert.equal(isYaleEmail(" Ada+Lab@Yale.EDU "), true);
  assert.equal(isYaleEmail("ada.name@yale.edu"), true);
});

test("rejects other domains, subdomains, and lookalikes", () => {
  for (const email of [
    "ada@cs.yale.edu",
    "ada@yale.edu.com",
    "ada@notyale.edu",
    "ada@yale.edu.attacker.com",
    "ada@yale.edutrue",
    "@yale.edu",
    "ada@",
    "ada@@yale.edu",
    "ada @yale.edu",
    "yale.edu",
    "",
    null,
  ]) {
    assert.equal(isYaleEmail(email), false, String(email));
  }
});
