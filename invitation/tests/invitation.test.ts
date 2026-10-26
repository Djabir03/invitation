import assert from "node:assert/strict";
import test from "node:test";

import { genererCodeInvite } from "../src/lib/invites/code.ts";
import { verifierCodeInvitation } from "../src/lib/invitations/code.ts";

/**
 * Tests du format des codes d'invitation.
 *
 * La page publique ne doit jamais interroger la base pour une chaîne qui ne
 * peut pas être un code : 32 caractères base64url exactement.
 */

test("un code généré passe la validation publique", () => {
  for (let index = 0; index < 20; index += 1) {
    assert.equal(verifierCodeInvitation(genererCodeInvite()), true);
  }
});

test("les longueurs autres que 32 sont refusées", () => {
  assert.equal(verifierCodeInvitation(""), false);
  assert.equal(verifierCodeInvitation("a".repeat(31)), false);
  assert.equal(verifierCodeInvitation("a".repeat(33)), false);
  assert.equal(verifierCodeInvitation("a".repeat(64)), false);
});

test("les caractères hors base64url sont refusés", () => {
  assert.equal(verifierCodeInvitation("a".repeat(30) + "+/"), false);
  assert.equal(verifierCodeInvitation("a".repeat(31) + "="), false);
  assert.equal(verifierCodeInvitation("a".repeat(31) + " "), false);
  assert.equal(verifierCodeInvitation("a".repeat(31) + "."), false);
  assert.equal(verifierCodeInvitation("é".repeat(32)), false);
});

test("un UUID ou un code court ne passe pas", () => {
  assert.equal(
    verifierCodeInvitation("7f78f9f1-2154-4f16-a781-24e10822fd47"),
    false
  );
  assert.equal(verifierCodeInvitation("abc123"), false);
});
