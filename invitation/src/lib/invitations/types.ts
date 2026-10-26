import type { StatutReponse } from "@/lib/invites/types";
import type { ModeleCarte } from "@/lib/validation/modele";

/**
 * Données strictement nécessaires à la page publique d'un invité.
 *
 * Aucun identifiant interne (organisateur, carte, invité), aucun chemin
 * Storage et aucun code d'invitation n'est transmis au composant d'affichage :
 * la page ne peut donc pas exposer par erreur les données d'un autre invité
 * ou le secret du lien.
 */
export type InvitationPublique = {
  nom: string;
  places: number;
  statut: StatutReponse;
  /** Date limite au format ISO, ou null si aucune échéance n'est fixée. */
  dateLimite: string | null;
  contenu: ModeleCarte;
  /**
   * Indique si la carte possède une photo. L'image est ensuite servie par
   * `/i/[code]/photo` : l'URL signée reste côté serveur, car le chemin Storage
   * contient l'identifiant de l'organisateur.
   */
  photoFondDisponible: boolean;
};
