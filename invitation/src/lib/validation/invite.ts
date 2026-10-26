import { z } from "zod";

/**
 * Validation des invités.
 *
 * Les mêmes schémas servent dans les Server Actions (autorité finale) et dans
 * les tests. Le navigateur ne fait que proposer des valeurs : tout est
 * revalidé côté serveur.
 */

/** Longueur maximale d'un nom, en caractères. */
export const NOM_INVITE_MAX = 120;

/** Nombre de places autorisé pour un invité. */
export const PLACES_MIN = 1;
export const PLACES_MAX = 20;

/** Plafond d'invités par carte, toutes méthodes d'ajout confondues. */
export const MAX_INVITES_PAR_CARTE = 300;

const MESSAGE_NOM = `Le nom est obligatoire (${NOM_INVITE_MAX} caractères maximum).`;

export const nomInviteSchema = z
  .string()
  .trim()
  .min(1, MESSAGE_NOM)
  .max(NOM_INVITE_MAX, MESSAGE_NOM);

export const placesSchema = z.coerce
  .number()
  .int("Le nombre de places doit être un entier.")
  .min(PLACES_MIN, `Indique au moins ${PLACES_MIN} place.`)
  .max(PLACES_MAX, `Le nombre de places ne peut pas dépasser ${PLACES_MAX}.`);

/** Vérifie qu'une date `AAAA-MM-JJ` existe réellement (pas de 31 février). */
export function dateIsoValide(valeur: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false;

  const [annee, mois, jour] = valeur.split("-").map(Number);
  const date = new Date(Date.UTC(annee, mois - 1, jour));

  return (
    date.getUTCFullYear() === annee &&
    date.getUTCMonth() === mois - 1 &&
    date.getUTCDate() === jour
  );
}

/**
 * Convertit une date de formulaire en fin de journée UTC.
 *
 * Le champ `<input type="date">` ne fournit pas d'heure : on choisit
 * volontairement 23:59:59 UTC pour que l'invité dispose de toute la journée.
 * Une chaîne vide signifie « pas de date limite » et devient `null`.
 */
export function dateLimiteEnIso(valeur: string): string | null {
  const propre = valeur.trim();
  return propre === "" ? null : `${propre}T23:59:59.000Z`;
}

export const dateLimiteSchema = z
  .string()
  .trim()
  .max(10, "Date limite invalide.")
  .refine((valeur) => valeur === "" || dateIsoValide(valeur), {
    message: "Date limite invalide.",
  })
  .transform(dateLimiteEnIso);

/** Champs du formulaire d'ajout d'un invité unique. */
export const inviteUnitaireSchema = z.object({
  carteId: z.uuid("Carte invalide."),
  nom: nomInviteSchema,
  places: placesSchema,
  dateLimite: dateLimiteSchema,
});

/** Une ligne de la liste collée, une fois nettoyée. */
export function extraireNoms(texte: string): string[] {
  return texte
    .split(/\r?\n/)
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0);
}

export type ResultatListeNoms =
  | { ok: true; noms: string[] }
  | { ok: false; erreur: string };

/**
 * Analyse la liste collée par l'organisateur : un nom par ligne, lignes vides
 * ignorées. La limite de 300 s'applique à la liste elle-même ; le plafond
 * restant de la carte est vérifié séparément dans l'action serveur.
 */
export function analyserListeNoms(texte: string): ResultatListeNoms {
  const noms = extraireNoms(texte);

  if (noms.length === 0) {
    return { ok: false, erreur: "Colle au moins un nom, un par ligne." };
  }

  if (noms.length > MAX_INVITES_PAR_CARTE) {
    return {
      ok: false,
      erreur: `Une liste ne peut pas dépasser ${MAX_INVITES_PAR_CARTE} noms.`,
    };
  }

  if (noms.some((nom) => nom.length > NOM_INVITE_MAX)) {
    return {
      ok: false,
      erreur: `Chaque nom doit faire ${NOM_INVITE_MAX} caractères maximum.`,
    };
  }

  return { ok: true, noms };
}

export const listeNomsSchema = z
  .array(nomInviteSchema)
  .min(1)
  .max(MAX_INVITES_PAR_CARTE);
