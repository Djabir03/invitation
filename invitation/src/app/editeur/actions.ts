"use server";

import { z } from "zod";

import { exigerUtilisateur } from "@/lib/auth/session";
import type { Json } from "@/lib/database.types";
import { verifierLimite } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { verifierContenuCarte } from "@/lib/validation/carte";
import { MODELES } from "@/templates";

/**
 * Actions serveur de l'éditeur.
 *
 * Règles appliquées ici :
 *   * `exigerUtilisateur()` est appelé dans chaque action ;
 *   * la propriété de la carte est vérifiée explicitement, en plus de la RLS ;
 *   * l'organisateur est toujours déduit de la session, jamais d'un champ
 *     envoyé par le navigateur (`organisateur` ou `organisateur_id`) ;
 *   * les retours sont génériques et ne révèlent pas l'existence d'une carte
 *     appartenant à un autre compte.
 */

const schemaUuid = z.uuid();

const MESSAGE_INDISPONIBLE =
  "Service momentanément indisponible. Réessaie dans un instant.";
const MESSAGE_CARTE_INTROUVABLE = "Carte introuvable.";
const MESSAGE_CONTENU_INVALIDE = "Contenu invalide. Vérifie les champs.";

export type EtatEnregistrement =
  | { succes: true }
  | { succes: false; erreur: string };

/**
 * Crée une carte préremplie avec le modèle choisi, puis renvoie son identifiant.
 * La navigation vers l'éditeur est faite côté client : appeler `redirect()`
 * dans une action déclenchée depuis un effet ferait rejeter la promesse et
 * afficherait une erreur alors que la carte a bien été créée.
 */
export async function creerCarteDepuisModele(
  modeleId: string
): Promise<{ carteId: string } | { erreur: string }> {
  const utilisateur = await exigerUtilisateur();

  const modele = MODELES.find((candidat) => candidat.id === modeleId);
  if (!modele) return { erreur: "Modèle introuvable." };

  const limite = verifierLimite(
    `creation-carte:${utilisateur.id}`,
    20,
    60 * 60 * 1000
  );
  if (!limite.autorise) {
    return { erreur: "Trop de cartes créées. Réessaie dans un instant." };
  }

  let carteId: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("cartes")
      .insert({
        // Identité déduite du serveur : aucune valeur d'organisateur ne vient
        // du navigateur.
        organisateur: utilisateur.id,
        modele: modele.id,
        // Le modèle a déjà été validé par Zod au chargement de l'index.
        contenu: modele as unknown as Json,
      })
      .select("id")
      .single();

    if (!error && data) carteId = data.id;
  } catch {
    return { erreur: MESSAGE_INDISPONIBLE };
  }

  if (!carteId) return { erreur: MESSAGE_INDISPONIBLE };

  return { carteId };
}

/**
 * Enregistre le contenu édité après validation Zod et vérification de
 * propriété. Le contenu reçu ne peut modifier que les textes marqués
 * `modifiable` de leur modèle.
 */
export async function enregistrerCarte(
  carteId: string,
  contenu: unknown
): Promise<EtatEnregistrement> {
  const utilisateur = await exigerUtilisateur();

  if (!schemaUuid.safeParse(carteId).success) {
    return { succes: false, erreur: MESSAGE_CARTE_INTROUVABLE };
  }

  const limite = verifierLimite(
    `enregistrement-carte:${utilisateur.id}`,
    120,
    5 * 60 * 1000
  );
  if (!limite.autorise) {
    return {
      succes: false,
      erreur: "Trop d'enregistrements. Réessaie dans quelques instants.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Double vérification : filtre SQL et contrôle explicite en mémoire.
    const { data: carte, error } = await supabase
      .from("cartes")
      .select("id, modele, organisateur")
      .eq("id", carteId)
      .eq("organisateur", utilisateur.id)
      .maybeSingle();

    if (error || !carte || carte.organisateur !== utilisateur.id) {
      return { succes: false, erreur: MESSAGE_CARTE_INTROUVABLE };
    }

    const modele = MODELES.find((candidat) => candidat.id === carte.modele);
    if (!modele) {
      return { succes: false, erreur: MESSAGE_CARTE_INTROUVABLE };
    }

    const verification = verifierContenuCarte(modele, contenu);
    if (!verification.ok) {
      return { succes: false, erreur: MESSAGE_CONTENU_INVALIDE };
    }

    const { data: miseAJour, error: erreurMiseAJour } = await supabase
      .from("cartes")
      .update({ contenu: verification.contenu as unknown as Json })
      .eq("id", carte.id)
      .eq("organisateur", utilisateur.id)
      .select("id")
      .maybeSingle();

    if (erreurMiseAJour || !miseAJour) {
      return { succes: false, erreur: MESSAGE_INDISPONIBLE };
    }

    return { succes: true };
  } catch {
    return { succes: false, erreur: MESSAGE_INDISPONIBLE };
  }
}
