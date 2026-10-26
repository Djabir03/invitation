import {
  modeleCarteSchema,
  type ElementTexte,
  type ModeleCarte,
} from "./modele.ts";

/**
 * Validation du contenu enregistré d'une carte.
 *
 * Le contenu est le modèle complet (fond, calque, éléments) avec les
 * modifications de l'organisateur. Le serveur ne se contente pas de vérifier la
 * forme : `verifierContenuCarte` compare le contenu reçu au modèle d'origine et
 * n'autorise que les champs éditables des éléments marqués `modifiable`.
 *
 * L'extension `.ts` dans l'import ci-dessus permet au test Node (type stripping)
 * de résoudre le module sans transpilation supplémentaire.
 */

/** Une carte ne peut jamais dépasser ce nombre d'éléments. */
export const LIMITE_ELEMENTS = 80;

/** Longueurs maximales des textes principaux, en caractères. */
export const LIMITES_TEXTES: Record<string, number> = {
  titre: 120,
  date: 100,
  lieu: 160,
  message: 500,
};

const LIMITE_TEXTE_PAR_DEFAUT = 300;

export function limiteTexte(id: string): number {
  return LIMITES_TEXTES[id] ?? LIMITE_TEXTE_PAR_DEFAUT;
}

/**
 * Schéma strict du contenu d'une carte.
 *
 * On part du schéma des modèles (format 1000 x 1400, couleurs, polices) puis on
 * resserre les limites : nombre maximal d'éléments, textes non vides et
 * longueurs maximales par texte.
 */
export const contenuCarteSchema = modeleCarteSchema.superRefine(
  (carte, contexte) => {
    if (carte.elements.length > LIMITE_ELEMENTS) {
      contexte.addIssue({
        code: "custom",
        path: ["elements"],
        message: `Une carte ne peut pas contenir plus de ${LIMITE_ELEMENTS} éléments.`,
      });
    }

    carte.elements.forEach((element, index) => {
      if (element.type !== "texte") return;

      if (element.contenu.trim().length === 0) {
        contexte.addIssue({
          code: "custom",
          path: ["elements", index, "contenu"],
          message: "Le texte ne peut pas être vide.",
        });
        return;
      }

      const limite = limiteTexte(element.id);
      if (element.contenu.length > limite) {
        contexte.addIssue({
          code: "custom",
          path: ["elements", index, "contenu"],
          message: `Le texte ne peut pas dépasser ${limite} caractères.`,
        });
      }
    });
  }
);

export type ModificationsTexte = Partial<
  Pick<
    ElementTexte,
    | "contenu"
    | "police"
    | "taillePolice"
    | "couleur"
    | "x"
    | "y"
    | "taille"
  >
>;

export type VerificationContenu =
  | { ok: true; contenu: ModeleCarte }
  | { ok: false; erreur: string };

/** Égalité profonde suffisante pour les valeurs JSON du modèle. */
function egal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false;
  }

  const clesA = Object.keys(a);
  const clesB = Object.keys(b);
  if (clesA.length !== clesB.length) return false;

  return clesA.every((cle) =>
    egal(
      (a as Record<string, unknown>)[cle],
      (b as Record<string, unknown>)[cle]
    )
  );
}

function invalide(): VerificationContenu {
  // Message volontairement générique : on ne détaille pas les champs refusés.
  return { ok: false, erreur: "Contenu invalide." };
}

/**
 * Vérifie le contenu envoyé par le navigateur contre le modèle d'origine.
 *
 * Seuls `contenu`, `police`, `taillePolice`, `couleur`, `x`, `y` et `taille`
 * peuvent varier, et uniquement sur les éléments `modifiable`. Le calque
 * (couleur et opacité) est également modifiable par l'organisateur. Toute
 * autre modification (fond, forme, agencement, rotation, alignement, ajout
 * d'élément…) est refusée.
 */
export function verifierContenuCarte(
  modele: ModeleCarte,
  valeur: unknown
): VerificationContenu {
  const resultat = contenuCarteSchema.safeParse(valeur);
  if (!resultat.success) return invalide();

  const contenu = resultat.data;

  const enteteIntacte =
    contenu.id === modele.id &&
    contenu.nom === modele.nom &&
    contenu.occasion === modele.occasion &&
    contenu.largeur === modele.largeur &&
    contenu.hauteur === modele.hauteur &&
    // Le fond (couleur, photo, obligation) reste verrouillé : la photo est
    // gérée par une colonne séparée, jamais par le contenu JSON.
    egal(contenu.fond, modele.fond);

  // Le calque est volontairement absent de cette comparaison : sa couleur et
  // son opacité sont éditables. Le schéma Zod borne déjà les valeurs.

  if (!enteteIntacte) return invalide();
  if (contenu.elements.length !== modele.elements.length) return invalide();

  for (let index = 0; index < modele.elements.length; index += 1) {
    const attendu = modele.elements[index];
    const recu = contenu.elements[index];

    if (!attendu || !recu) return invalide();
    if (
      recu.id !== attendu.id ||
      recu.type !== attendu.type ||
      recu.modifiable !== attendu.modifiable
    ) {
      return invalide();
    }

    // Les éléments non modifiables doivent être strictement identiques.
    if (!attendu.modifiable) {
      if (!egal(attendu, recu)) return invalide();
      continue;
    }

    // Pour l'instant, seuls des textes sont modifiables. Une forme marquée
    // modifiable ne peut pas être enregistrée par cet éditeur.
    if (attendu.type !== "texte" || recu.type !== "texte") return invalide();

    // On reconstruit l'élément avec les seuls champs autorisés : tout champ
    // supplémentaire modifié fait échouer la comparaison.
    const autorise: ElementTexte = {
      ...attendu,
      contenu: recu.contenu,
      police: recu.police,
      taillePolice: recu.taillePolice,
      couleur: recu.couleur,
      x: recu.x,
      y: recu.y,
      taille: recu.taille,
    };

    if (!egal(autorise, recu)) return invalide();
  }

  return { ok: true, contenu };
}
