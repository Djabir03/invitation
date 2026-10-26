import type { Database } from "@/lib/database.types";

/**
 * Types partagés entre le serveur et l'interface des invités.
 *
 * Ce fichier ne dépend ni de Next.js ni de Supabase : il peut être importé
 * sans risque par un composant client.
 */

export type StatutReponse = Database["public"]["Enums"]["statut_reponse"];

/** Invité tel qu'il est affiché dans le tableau de l'organisateur. */
export type InviteListe = {
  id: string;
  nom: string;
  places: number;
  /** Date limite au format ISO, ou null si aucune échéance n'est fixée. */
  dateLimite: string | null;
  /** Lien complet, construit côté serveur à partir du code. */
  lien: string;
  statut: StatutReponse;
};

/** Données nécessaires à la page des invités d'une carte. */
export type DonneesInvites = {
  carteId: string;
  titre: string;
  invites: InviteListe[];
  /** Nombre d'invités encore autorisés (plafond de 300 par carte). */
  restants: number;
};
