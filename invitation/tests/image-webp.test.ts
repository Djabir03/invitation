import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { convertirEnWebp } from "../src/lib/images/webp.ts";

/**
 * Tests réels du pipeline sharp : le serveur ne doit jamais stocker l'image
 * d'origine, mais un WebP borné en largeur et débarrassé de ses métadonnées.
 */

async function jpegAvecExif(largeur: number, hauteur: number): Promise<Buffer> {
  return sharp({
    create: {
      width: largeur,
      height: hauteur,
      channels: 3,
      background: { r: 51, g: 102, b: 153 },
    },
  })
    .jpeg({ quality: 90 })
    .withMetadata({
      exif: {
        IFD0: {
          Copyright: "Photo de test",
          Software: "Test",
        },
      },
    })
    .toBuffer();
}

test("une grande image est ramenée à 2000 px de large en WebP", async () => {
  const source = await jpegAvecExif(3000, 2000);

  // Le JPEG d'entrée porte bien des métadonnées EXIF.
  const entree = await sharp(source).metadata();
  assert.ok(entree.exif && entree.exif.length > 0);

  const sortie = await convertirEnWebp(source);
  const metadonnees = await sharp(sortie).metadata();

  assert.equal(metadonnees.format, "webp");
  assert.equal(metadonnees.width, 2000);
  assert.ok((metadonnees.height ?? 0) < 2000);
});

test("les métadonnées EXIF sont supprimées", async () => {
  const source = await jpegAvecExif(1600, 1200);
  const sortie = await convertirEnWebp(source);
  const metadonnees = await sharp(sortie).metadata();

  assert.equal(metadonnees.exif, undefined);
  assert.equal(metadonnees.orientation, undefined);
});

test("une petite image n'est pas agrandie", async () => {
  const source = await jpegAvecExif(800, 600);
  const sortie = await convertirEnWebp(source);
  const metadonnees = await sharp(sortie).metadata();

  assert.equal(metadonnees.format, "webp");
  assert.equal(metadonnees.width, 800);
  assert.equal(metadonnees.height, 600);
});

test("un contenu qui n'est pas une image est rejeté", async () => {
  const texte = new TextEncoder().encode("Ceci n'est pas une image.");

  await assert.rejects(() => convertirEnWebp(texte));
});
