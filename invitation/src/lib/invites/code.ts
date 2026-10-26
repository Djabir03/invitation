import { randomBytes } from "node:crypto";

/**
 * Génération des codes d'invitation.
 *
 * Le code est produit exclusivement côté serveur : il ne doit jamais être
 * calculé ni deviné dans le navigateur. 24 octets aléatoires encodés en
 * base64url donnent 32 caractères non séquentiels, sans caractère à échapper
 * dans une URL.
 *
 * La contrainte `unique` de la colonne `invites.code` reste la garantie
 * finale : en cas de collision (probabilité infime), l'appelant régénère.
 */

export const OCTETS_CODE_INVITE = 24;
export const LONGUEUR_CODE_INVITE = 32;

/** Un code aléatoire de 32 caractères (base64url, sans remplissage). */
export function genererCodeInvite(): string {
  return randomBytes(OCTETS_CODE_INVITE).toString("base64url");
}
