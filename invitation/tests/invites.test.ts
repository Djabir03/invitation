import assert from "node:assert/strict";
import test from "node:test";

import {
  LONGUEUR_CODE_INVITE,
  genererCodeInvite,
} from "../src/lib/invites/code.ts";
import {
  lienInvitation,
  lienWhatsApp,
  messageInvitationWhatsApp,
  normaliserBaseSite,
} from "../src/lib/invites/lien.ts";
import { libelleStatut } from "../src/lib/invites/statut.ts";
import {
  MAX_INVITES_PAR_CARTE,
  NOM_INVITE_MAX,
  analyserListeNoms,
  dateLimiteEnIso,
  dateIsoValide,
  dateLimiteSchema,
  extraireNoms,
  inviteUnitaireSchema,
  nomInviteSchema,
} from "../src/lib/validation/invite.ts";

/**
 * Tests des règles des invités.
 *
 * Ils portent sur les fonctions pures : génération du code, construction des
 * liens, encodage du message WhatsApp, validation des noms, des places et des
 * dates. Aucun accès réseau ni navigateur n'est nécessaire.
 */

const CARTE = "7f78f9f1-2154-4f16-a781-24e10822fd47";

test("un code fait 32 caractères base64url et reste unique", () => {
  const codes = new Set(Array.from({ length: 50 }, () => genererCodeInvite()));

  assert.equal(codes.size, 50);

  for (const code of codes) {
    assert.equal(code.length, LONGUEUR_CODE_INVITE);
    assert.match(code, /^[A-Za-z0-9_-]{32}$/);
  }
});

test("le lien d'invitation est construit sur la base publique", () => {
  assert.equal(
    lienInvitation("abcdefghijklmnopqrstuvwxyz012345", "https://exemple.test/"),
    "https://exemple.test/i/abcdefghijklmnopqrstuvwxyz012345"
  );

  // Les slashs finals ne doivent pas produire de double slash.
  assert.equal(normaliserBaseSite(" https://exemple.test/// "), "https://exemple.test");
  assert.equal(
    lienInvitation("code", "https://exemple.test///"),
    "https://exemple.test/i/code"
  );
});

test("le message WhatsApp est entièrement encodé", () => {
  const message = messageInvitationWhatsApp({
    nom: "Awa & Ibrahim",
    titre: "Mariage d'Awa & Ibrahim",
    lien: "https://exemple.test/i/abc",
  });

  const url = lienWhatsApp(message);
  const analyse = new URL(url);

  assert.equal(analyse.origin + analyse.pathname, "https://wa.me/");
  assert.equal(analyse.searchParams.get("text"), message);

  // Les espaces, accents et esperluettes passent par encodeURIComponent.
  assert.ok(!url.includes(" "));
  assert.ok(url.includes("Awa%20%26%20Ibrahim"));
  assert.ok(message.includes("Mariage d'Awa & Ibrahim"));
  assert.ok(message.includes("https://exemple.test/i/abc"));
});

test("la liste accepte un nom par ligne et ignore les lignes vides", () => {
  const resultat = analyserListeNoms(
    "  Awa Diallo  \r\n\r\nIbrahim Traoré\n   \nFatou Bâ\n"
  );

  assert.deepEqual(resultat, {
    ok: true,
    noms: ["Awa Diallo", "Ibrahim Traoré", "Fatou Bâ"],
  });

  assert.deepEqual(extraireNoms("\n\n"), []);
});

test("la liste refuse une saisie vide, trop longue ou un nom trop long", () => {
  assert.equal(analyserListeNoms(" \n ").ok, false);

  const tropDeNoms = Array.from(
    { length: MAX_INVITES_PAR_CARTE + 1 },
    (_, index) => `Invité ${index}`
  ).join("\n");
  assert.equal(analyserListeNoms(tropDeNoms).ok, false);

  assert.equal(analyserListeNoms("a".repeat(NOM_INVITE_MAX + 1)).ok, false);

  // La limite exacte reste acceptée.
  const limite = Array.from(
    { length: MAX_INVITES_PAR_CARTE },
    (_, index) => `Invité ${index}`
  ).join("\n");
  assert.equal(analyserListeNoms(limite).ok, true);
});

test("les dates invalides sont refusées et la limite est stockée en fin de journée UTC", () => {
  assert.equal(dateIsoValide("2024-02-29"), true);
  assert.equal(dateIsoValide("2026-02-29"), false);
  assert.equal(dateIsoValide("2026-13-01"), false);
  assert.equal(dateIsoValide("31/12/2026"), false);

  assert.equal(dateLimiteEnIso(""), null);
  assert.equal(dateLimiteEnIso("   "), null);
  assert.equal(
    dateLimiteEnIso("2026-12-31"),
    "2026-12-31T23:59:59.000Z"
  );

  assert.equal(dateLimiteSchema.safeParse("").success, true);
  assert.equal(dateLimiteSchema.safeParse("2026-02-31").success, false);
  assert.equal(dateLimiteSchema.safeParse("2026-12-31").data, "2026-12-31T23:59:59.000Z");
});

test("le schéma d'un invité borne le nom et les places", () => {
  const valide = inviteUnitaireSchema.parse({
    carteId: CARTE,
    nom: "  Awa Diallo  ",
    places: "4",
    dateLimite: "2026-12-31",
  });

  assert.deepEqual(valide, {
    carteId: CARTE,
    nom: "Awa Diallo",
    places: 4,
    dateLimite: "2026-12-31T23:59:59.000Z",
  });

  const base = { carteId: CARTE, nom: "Awa", dateLimite: "" };
  assert.equal(inviteUnitaireSchema.safeParse({ ...base, places: "1" }).success, true);
  assert.equal(inviteUnitaireSchema.safeParse({ ...base, places: "20" }).success, true);
  assert.equal(inviteUnitaireSchema.safeParse({ ...base, places: "0" }).success, false);
  assert.equal(inviteUnitaireSchema.safeParse({ ...base, places: "21" }).success, false);
  assert.equal(inviteUnitaireSchema.safeParse({ ...base, places: "2.5" }).success, false);
  assert.equal(inviteUnitaireSchema.safeParse({ ...base, nom: "   " }).success, false);
  assert.equal(inviteUnitaireSchema.safeParse({ ...base, nom: "a".repeat(NOM_INVITE_MAX + 1) }).success, false);

  assert.equal(nomInviteSchema.parse("  Awa  "), "Awa");
});

test("les statuts affichés couvrent l'absence de réponse", () => {
  assert.equal(libelleStatut(null), "En attente");
  assert.equal(libelleStatut(undefined), "En attente");
  assert.equal(libelleStatut("en_attente"), "En attente");
  assert.equal(libelleStatut("vient"), "Vient");
  assert.equal(libelleStatut("ne_vient_pas"), "Ne vient pas");
});
