/**
 * Format d'un code d'invitation.
 *
 * Un code est produit côté serveur avec `crypto.randomBytes(24)` puis encodé
 * en base64url : 24 octets donnent exactement 32 caractères, sans padding.
 * Ce module est volontairement pur (aucun accès base ni secret) pour être
 * testable et utilisable des deux côtés de la frontière serveur/client.
 */
const FORMAT_CODE = /^[A-Za-z0-9_-]{32}$/;

/** Indique si la chaîne a exactement la forme d'un code d'invitation. */
export function verifierCodeInvitation(code: string): boolean {
  return FORMAT_CODE.test(code);
}
