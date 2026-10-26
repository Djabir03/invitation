import { z } from "zod";

/**
 * Schémas d'authentification de l'organisateur.
 *
 * Règles :
 *   - l'e-mail est normalisé (espaces + minuscules) avant l'envoi à Supabase ;
 *   - le mot de passe n'est jamais trimé (les espaces sont significatifs) ;
 *   - 6 caractères minimum (la longueur reste recommandée) ;
 *   - 72 caractères maximum (limite de bcrypt utilisé par Supabase Auth).
 */

const emailSchema = z
  .string({ error: "L'adresse e-mail est requise." })
  .trim()
  .toLowerCase()
  .min(1, "L'adresse e-mail est requise.")
  .max(254, "L'adresse e-mail est trop longue.")
  .pipe(z.email("L'adresse e-mail n'est pas valide."));

const motDePasseInscriptionSchema = z
  .string({ error: "Le mot de passe est requis." })
  .min(6, "Le mot de passe doit contenir au moins 6 caractères.")
  .max(72, "Le mot de passe ne peut pas dépasser 72 caractères.");

export const inscriptionSchema = z
  .object({
    email: emailSchema,
    motDePasse: motDePasseInscriptionSchema,
    confirmation: z
      .string({ error: "La confirmation du mot de passe est requise." })
      .min(1, "La confirmation du mot de passe est requise."),
  })
  .refine((donnees) => donnees.motDePasse === donnees.confirmation, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["confirmation"],
  });

export const connexionSchema = z.object({
  email: emailSchema,
  // On n'impose pas la longueur minimale ici : un compte existant pourrait
  // avoir été créé avant cette règle. La validation réelle est faite par Supabase.
  motDePasse: z
    .string({ error: "Le mot de passe est requis." })
    .min(1, "Le mot de passe est requis.")
    .max(72, "Le mot de passe ne peut pas dépasser 72 caractères."),
});

export type InscriptionInput = z.infer<typeof inscriptionSchema>;
export type ConnexionInput = z.infer<typeof connexionSchema>;
