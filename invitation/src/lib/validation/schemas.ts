import { z } from "zod";

/**
 * Schémas de validation partagés (serveur et client).
 * Toute entrée utilisateur doit passer par l'un de ces schémas avant
 * d'atteindre la base de données (OWASP : validation des entrées).
 *
 * Rappel de sécurité : `organisateur` et `code` ne figurent jamais dans les
 * schémas d'entrée. Ils sont déduits/générés côté serveur, jamais lus depuis
 * les arguments envoyés par le navigateur.
 */

export const statutReponseSchema = z.enum([
  "en_attente",
  "vient",
  "ne_vient_pas",
]);

/** Contenu éditable d'une carte (stocké en jsonb dans `cartes.contenu`). */
export const carteContenuSchema = z.object({
  titre: z.string().max(200).optional(),
  date: z.string().max(100).optional(),
  lieu: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  couleurs: z.record(z.string(), z.string()).optional(),
  police: z.string().max(100).optional(),
  photos: z.array(z.string().url()).max(3).optional(),
});

export const carteSchema = z.object({
  modele: z.string().min(1).max(100),
  contenu: carteContenuSchema,
  photoFondUrl: z.string().url().nullish(),
});

export const inviteSchema = z.object({
  nom: z.string().min(1).max(200),
  places: z.number().int().min(1).max(50).default(1),
  dateLimite: z.coerce.date().nullish(),
});

export const reponseSchema = z.object({
  statut: statutReponseSchema,
  nombrePersonnes: z.number().int().min(1).max(50).nullish(),
});

export type StatutReponse = z.infer<typeof statutReponseSchema>;
export type CarteInput = z.infer<typeof carteSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type ReponseInput = z.infer<typeof reponseSchema>;
