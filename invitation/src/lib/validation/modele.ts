import { z } from "zod";

/**
 * Schéma des modèles de cartes d'invitation.
 *
 * Toutes les coordonnées sont exprimées dans le repère du canevas (1000 x 1400
 * pour le format portrait du MVP). L'aperçu les convertit en pourcentages :
 * un modèle reste donc indépendant de la taille d'affichage.
 *
 * Aucune image externe n'est autorisée dans les modèles : uniquement des
 * couleurs, des formes géométriques et du texte. Le champ `photo` est prévu
 * pour la photo de fond téléversée plus tard par l'organisateur.
 */

/** Polices Google autorisées. Cette liste est la seule source de vérité. */
export const POLICES_AUTORISEES = [
  "Playfair Display",
  "Cormorant Garamond",
  "Lora",
  "Montserrat",
  "Poppins",
  "Cinzel",
  "Great Vibes",
  "Bebas Neue",
] as const;

export type Police = (typeof POLICES_AUTORISEES)[number];

/** Occasions couvertes par les dix modèles du MVP. */
export const OCCASIONS = [
  "mariage",
  "anniversaire",
  "bapteme",
  "ceremonie",
  "soiree",
  "entreprise",
  "diplome",
  "fetes",
] as const;

export type Occasion = (typeof OCCASIONS)[number];

const couleurSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue (#RRGGBB).");

const opaciteSchema = z.number().min(0).max(1);

const tailleSchema = z
  .object({
    largeur: z.number().finite().positive().max(2000),
    hauteur: z.number().finite().positive().max(2000),
  })
  .strict();

const elementBaseSchema = z.object({
  id: z.string().min(1).max(80),
  x: z.number().finite(),
  y: z.number().finite(),
  taille: tailleSchema,
  rotation: z.number().finite().min(-360).max(360),
  modifiable: z.boolean(),
});

const elementTexteSchema = elementBaseSchema
  .extend({
    type: z.literal("texte"),
    contenu: z.string().min(1).max(500),
    police: z.enum(POLICES_AUTORISEES),
    taillePolice: z.number().finite().min(8).max(300),
    couleur: couleurSchema,
    alignement: z.enum(["gauche", "centre", "droite"]),
  })
  .strict();

const elementFormeSchema = elementBaseSchema
  .extend({
    type: z.literal("forme"),
    forme: z.enum(["rectangle", "cercle", "losange", "ligne"]),
    couleur: couleurSchema,
    opacite: opaciteSchema.default(1),
  })
  .strict();

export const elementModeleSchema = z.discriminatedUnion("type", [
  elementTexteSchema,
  elementFormeSchema,
]);

export const fondSchema = z
  .object({
    couleur: couleurSchema,
    /** URL de la photo de fond. Null tant qu'aucune photo n'est fournie. */
    photo: z.string().url().nullish(),
    photoObligatoire: z.boolean(),
  })
  .strict();

export const calqueSchema = z
  .object({
    couleur: couleurSchema,
    opacite: opaciteSchema,
  })
  .strict();

export const modeleCarteSchema = z
  .object({
    id: z
      .string()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Identifiant en minuscules et tirets attendu."
      ),
    nom: z.string().min(1).max(120),
    occasion: z.enum(OCCASIONS),
    // Format portrait imposé pour le MVP.
    largeur: z.literal(1000),
    hauteur: z.literal(1400),
    fond: fondSchema,
    calque: calqueSchema,
    elements: z.array(elementModeleSchema).min(4),
  })
  .strict();

export type ElementModele = z.infer<typeof elementModeleSchema>;
export type ElementTexte = Extract<ElementModele, { type: "texte" }>;
export type ElementForme = Extract<ElementModele, { type: "forme" }>;
export type Fond = z.infer<typeof fondSchema>;
export type Calque = z.infer<typeof calqueSchema>;
export type ModeleCarte = z.infer<typeof modeleCarteSchema>;
