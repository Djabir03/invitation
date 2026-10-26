/**
 * Détection du format réel d'une image à partir de ses premiers octets.
 *
 * L'en-tête `Content-Type` et l'extension d'un fichier sont fournis par le
 * client : ils ne prouvent rien. Le serveur ne se fie donc qu'aux octets
 * magiques pour accepter un JPEG, un PNG ou un WebP.
 *
 * Aucune dépendance Node n'est utilisée ici : ce module est testable avec
 * `node --experimental-strip-types` et peut aussi servir côté navigateur.
 */

export type FormatImage = "jpeg" | "png" | "webp";

/** Extensions acceptées, en minuscules et sans le point. */
export const EXTENSIONS_PHOTO = ["jpg", "jpeg", "png", "webp"] as const;

export type ExtensionPhoto = (typeof EXTENSIONS_PHOTO)[number];

/** Extensions associées à chaque format réel. */
const EXTENSIONS_PAR_FORMAT: Record<FormatImage, readonly string[]> = {
  jpeg: ["jpg", "jpeg"],
  png: ["png"],
  webp: ["webp"],
};

/** Type MIME attendu, utilisé uniquement pour les journaux serveur. */
export const MIME_PAR_FORMAT: Record<FormatImage, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Extrait l'extension d'un nom de fichier, ou null si elle est absente. */
export function extensionDeNom(nom: string): string | null {
  const point = nom.lastIndexOf(".");

  // Un nom commençant par un point (`.jpg`) n'a pas de nom de base : refusé.
  if (point < 1 || point === nom.length - 1) return null;

  return nom.slice(point + 1).toLowerCase();
}

/** Indique si l'extension fait partie de la liste blanche. */
export function estExtensionImageAutorisee(nom: string): boolean {
  const extension = extensionDeNom(nom);
  if (!extension) return false;

  return EXTENSIONS_PHOTO.includes(extension as ExtensionPhoto);
}

/**
 * Indique si l'extension annoncée correspond au format réellement détecté.
 * Un PNG renommé en `.jpg` est donc refusé.
 */
export function extensionCompatible(
  nom: string,
  format: FormatImage
): boolean {
  const extension = extensionDeNom(nom);
  if (!extension) return false;

  return EXTENSIONS_PAR_FORMAT[format].includes(extension);
}

function commencePar(octets: Uint8Array, signature: readonly number[]): boolean {
  if (octets.length < signature.length) return false;

  return signature.every((valeur, index) => octets[index] === valeur);
}

function texteA(octets: Uint8Array, position: number, texte: string): boolean {
  if (octets.length < position + texte.length) return false;

  for (let index = 0; index < texte.length; index += 1) {
    if (octets[position + index] !== texte.charCodeAt(index)) return false;
  }

  return true;
}

/**
 * Retourne le format réel de l'image, ou null si elle n'est pas autorisée.
 *
 * Signatures :
 *   * JPEG : FF D8 FF
 *   * PNG  : 89 50 4E 47 0D 0A 1A 0A
 *   * WebP : « RIFF » .... « WEBP »
 *
 * Les fichiers ZIP (`PK`), SVG (`<?xml`, `<svg`) et les fichiers texte ne
 * correspondent à aucune signature : ils sont refusés.
 */
export function detecterFormatImage(octets: Uint8Array): FormatImage | null {
  if (commencePar(octets, [0xff, 0xd8, 0xff])) return "jpeg";

  if (
    commencePar(octets, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "png";
  }

  if (
    texteA(octets, 0, "RIFF") &&
    texteA(octets, 8, "WEBP") &&
    octets.length >= 12
  ) {
    return "webp";
  }

  return null;
}
