import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { modeleCarteSchema } from "@/lib/validation/modele";

import { verifierCodeInvitation } from "./code";
import type { InvitationPublique } from "./types";

/**
 * Lecture serveur de l'invitation publique.
 *
 * Le client `service_role` contourne la RLS : il est utilisé ici parce que le
 * visiteur n'a pas de compte. La requête est paramétrée sur `code` et ne
 * sélectionne qu'une seule ligne. Aucun code n'est journalisé, et l'objet
 * renvoyé ne contient ni identifiant interne ni autre invité.
 */

/** Chemin Storage attendu : [user_id]/[carte_id]/[uuid].webp. */
const CHEMIN_PHOTO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i;

/**
 * Vérifie qu'un code correspond bien à une invitation existante.
 *
 * Utilisé par le proxy avant le rendu : c'est ce contrôle qui permet de
 * renvoyer un vrai statut HTTP 404, impossible à produire depuis la page une
 * fois le flux partiel commencé. La requête ne lit que la clé primaire.
 *
 * En cas de panne Supabase, on répond `true` : la page tentera la lecture
 * complète et affichera elle-même l'écran « introuvable ». Une panne ne doit
 * pas être transformée en fausse 404.
 */
export async function invitationPubliqueExiste(code: string): Promise<boolean> {
  if (!verifierCodeInvitation(code)) return false;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("invites")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      console.error(
        "[invitation] vérification du code impossible",
        error.code ?? "inconnu"
      );
      return true;
    }

    return data !== null;
  } catch {
    return true;
  }
}

/**
 * Charge l'invité, sa carte et son statut de réponse.
 *
 * Toute anomalie (format, absence, contenu illisible, panne) renvoie `null` :
 * la page affiche alors la même réponse « Invitation introuvable », sans
 * distinguer un code inexistant d'un code invalide.
 */
export async function chargerInvitationPublique(
  code: string
): Promise<InvitationPublique | null> {
  if (!verifierCodeInvitation(code)) return null;

  try {
    const supabase = createSupabaseAdminClient();

    const { data: invite, error: erreurInvite } = await supabase
      .from("invites")
      .select("id, nom, places, date_limite, carte_id")
      .eq("code", code)
      .maybeSingle();

    if (erreurInvite) {
      // Le code d'erreur seul est sûr : ni le code d'invitation ni les
      // détails SQL ne doivent apparaître dans les journaux.
      console.error(
        "[invitation] lecture de l'invité impossible",
        erreurInvite.code ?? "inconnu"
      );
      return null;
    }

    if (!invite) return null;

    const { data: carte, error: erreurCarte } = await supabase
      .from("cartes")
      .select("contenu, photo_fond_chemin")
      .eq("id", invite.carte_id)
      .maybeSingle();

    if (erreurCarte || !carte) {
      if (erreurCarte) {
        console.error(
          "[invitation] lecture de la carte impossible",
          erreurCarte.code ?? "inconnu"
        );
      }
      return null;
    }

    // Le contenu vient de la base : on le revalide avant de le rendre. Un
    // contenu corrompu produit la même page qu'un code inconnu.
    const contenu = modeleCarteSchema.safeParse(carte.contenu);
    if (!contenu.success) {
      console.error("[invitation] contenu de carte illisible");
      return null;
    }

    const { data: reponse, error: erreurReponse } = await supabase
      .from("reponses")
      .select("statut")
      .eq("invite_id", invite.id)
      .maybeSingle();

    if (erreurReponse) {
      // Le statut n'est pas indispensable à l'affichage : on continue en
      // considérant l'invité comme « en attente ».
      console.error(
        "[invitation] lecture de la réponse impossible",
        erreurReponse.code ?? "inconnu"
      );
    }

    let photoFondDisponible = false;

    if (carte.photo_fond_chemin && CHEMIN_PHOTO.test(carte.photo_fond_chemin)) {
      photoFondDisponible = true;
    }

    return {
      nom: invite.nom,
      places: invite.places,
      statut: reponse?.statut ?? "en_attente",
      dateLimite: invite.date_limite,
      contenu: contenu.data,
      photoFondDisponible,
    };
  } catch {
    return null;
  }
}

/**
 * Chemin Storage de la photo de fond d'une invitation, si elle existe.
 *
 * Réservé à la route `/i/[code]/photo`, qui signe puis relaie l'image côté
 * serveur. Le chemin n'est jamais transmis au navigateur : il contient
 * l'identifiant de l'organisateur et celui de la carte.
 */
export async function chargerCheminPhotoPublique(
  code: string
): Promise<string | null> {
  if (!verifierCodeInvitation(code)) return null;

  try {
    const supabase = createSupabaseAdminClient();

    const { data: invite, error: erreurInvite } = await supabase
      .from("invites")
      .select("carte_id")
      .eq("code", code)
      .maybeSingle();

    if (erreurInvite || !invite) {
      if (erreurInvite) {
        console.error(
          "[invitation] lecture de l'invité impossible",
          erreurInvite.code ?? "inconnu"
        );
      }
      return null;
    }

    const { data: carte, error: erreurCarte } = await supabase
      .from("cartes")
      .select("photo_fond_chemin")
      .eq("id", invite.carte_id)
      .maybeSingle();

    if (erreurCarte) {
      console.error(
        "[invitation] lecture de la photo impossible",
        erreurCarte.code ?? "inconnu"
      );
      return null;
    }

    const chemin = carte?.photo_fond_chemin;

    if (!chemin || !CHEMIN_PHOTO.test(chemin)) return null;

    return chemin;
  } catch {
    return null;
  }
}
