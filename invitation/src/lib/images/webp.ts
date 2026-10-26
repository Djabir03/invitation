import sharp from "sharp";

import { LARGEUR_MAX_PHOTO } from "../photo-fond.ts";

/**
 * Décode une image puis la ré-encode en WebP.
 *
 * Cette fonction est la seule frontière de confiance pour le contenu binaire
 * d'une photo :
 *   * `limitInputPixels` borne la surface décodée (protection contre les
 *     images « piégées » qui décompressent en mémoire gigantesque) ;
 *   * `.rotate()` applique l'orientation EXIF avant de la supprimer ;
 *   * la largeur est ramenée à 2000 px maximum, sans agrandir une petite
 *     image ;
 *   * sharp n'écrit aucune métadonnée par défaut : EXIF, GPS, XMP et IPTC
 *     disparaissent.
 *
 * Le résultat est toujours un WebP. L'appelant doit avoir vérifié la
 * signature du fichier avant d'arriver ici.
 */

/** 40 mégapixels : large pour une photo courante, bloquant les images piégées. */
const LIMITE_PIXELS = 40_000_000;

export async function convertirEnWebp(octets: Uint8Array): Promise<Buffer> {
  return sharp(Buffer.from(octets), {
    limitInputPixels: LIMITE_PIXELS,
    failOn: "error",
    sequentialRead: true,
  })
    .rotate()
    .resize({
      width: LARGEUR_MAX_PHOTO,
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}
