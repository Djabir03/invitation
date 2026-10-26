import assert from "node:assert/strict";
import test from "node:test";

import {
  detecterFormatImage,
  estExtensionImageAutorisee,
  extensionCompatible,
} from "../src/lib/images/format.ts";
import {
  BUCKET_PHOTOS_FOND,
  LARGEUR_MAX_PHOTO,
  LARGEUR_MIN_PHOTO,
  TAILLE_MAX_PHOTO_OCTETS,
  cheminPhotoFond,
  cheminPhotoValide,
} from "../src/lib/photo-fond.ts";

/**
 * Tests des contrôles qui protègent l'envoi de la photo de fond :
 * liste blanche d'extensions, octets magiques et forme du chemin Storage.
 *
 * Ces vérifications ne dépendent ni de Next.js ni de Supabase : elles sont
 * exécutées avec le type stripping de Node.
 */

const PROPRIETAIRE = "82ebcf37-73fb-4a87-8823-c0d130ba314c";
const AUTRE_COMPTE = "a2918c69-f2a0-43ca-ae69-4bb4abf20ab2";
const CARTE = "7f78f9f1-2154-4f16-a781-24e10822fd47";
const AUTRE_CARTE = "6932b965-9771-47ce-ad99-c6472ab13116";
const FICHIER = "3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b";

function jpeg(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
}

function png(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
}

function webp(): Uint8Array {
  const octets = new Uint8Array(16);
  octets.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  octets.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return octets;
}

const texte = new TextEncoder().encode("Ceci est un fichier texte, pas une image.");
const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

test("les signatures JPEG, PNG et WebP sont reconnues", () => {
  assert.equal(detecterFormatImage(jpeg()), "jpeg");
  assert.equal(detecterFormatImage(png()), "png");
  assert.equal(detecterFormatImage(webp()), "webp");
});

test("un fichier texte, ZIP ou SVG renommé en .jpg est refusé", () => {
  // L'extension est valide, mais aucune signature d'image n'est présente :
  // c'est exactement le scénario « fichier texte renommé en .jpg ».
  assert.equal(estExtensionImageAutorisee("document.jpg"), true);

  for (const contenu of [texte, zip, svg]) {
    assert.equal(detecterFormatImage(contenu), null);
  }
});

test("seules les extensions jpg, jpeg, png et webp sont acceptées", () => {
  for (const nom of [
    "photo.jpg",
    "photo.JPG",
    "photo.jpeg",
    "photo.JPEG",
    "photo.png",
    "photo.webp",
  ]) {
    assert.equal(estExtensionImageAutorisee(nom), true, nom);
  }

  for (const nom of [
    "photo.gif",
    "photo.svg",
    "photo.zip",
    "photo",
    "photo.",
    ".jpg",
    "photo.jpg.exe",
    "photo.webp/../secret",
  ]) {
    assert.equal(estExtensionImageAutorisee(nom), false, nom);
  }
});

test("l'extension doit correspondre au format réel", () => {
  assert.equal(extensionCompatible("photo.jpg", "jpeg"), true);
  assert.equal(extensionCompatible("photo.jpeg", "jpeg"), true);
  assert.equal(extensionCompatible("photo.png", "png"), true);
  assert.equal(extensionCompatible("photo.webp", "webp"), true);

  // Un PNG renommé en .jpg, ou l'inverse, est refusé.
  assert.equal(extensionCompatible("photo.jpg", "png"), false);
  assert.equal(extensionCompatible("photo.png", "jpeg"), false);
  assert.equal(extensionCompatible("photo.webp", "jpeg"), false);
});

test("le chemin Storage suit [user_id]/[carte_id]/[uuid].webp", () => {
  const chemin = cheminPhotoFond(PROPRIETAIRE, CARTE, FICHIER);

  assert.equal(chemin, `${PROPRIETAIRE}/${CARTE}/${FICHIER}.webp`);
  assert.equal(cheminPhotoValide(chemin, PROPRIETAIRE, CARTE), true);
});

test("un chemin d'un autre compte ou d'une autre carte est refusé", () => {
  const chemin = cheminPhotoFond(PROPRIETAIRE, CARTE, FICHIER);

  assert.equal(cheminPhotoValide(chemin, AUTRE_COMPTE, CARTE), false);
  assert.equal(cheminPhotoValide(chemin, PROPRIETAIRE, AUTRE_CARTE), false);
});

test("les chemins malformés ou hors dossier sont refusés", () => {
  const chemins = [
    `${PROPRIETAIRE}/${CARTE}/pas-un-uuid.webp`,
    `${PROPRIETAIRE}/${CARTE}/${FICHIER}.png`,
    `${PROPRIETAIRE}/${CARTE}/${FICHIER}.webp/extra`,
    `../${PROPRIETAIRE}/${CARTE}/${FICHIER}.webp`,
    `${PROPRIETAIRE}/../${CARTE}/${FICHIER}.webp`,
    `${PROPRIETAIRE}/${CARTE}/${FICHIER}`,
    "",
  ];

  for (const chemin of chemins) {
    assert.equal(
      cheminPhotoValide(chemin, PROPRIETAIRE, CARTE),
      false,
      chemin || "(vide)"
    );
  }
});

test("les limites partagées correspondent au cahier des charges", () => {
  assert.equal(BUCKET_PHOTOS_FOND, "photos-fond");
  assert.equal(TAILLE_MAX_PHOTO_OCTETS, 5 * 1024 * 1024);
  assert.equal(LARGEUR_MIN_PHOTO, 1200);
  assert.equal(LARGEUR_MAX_PHOTO, 2000);
});
