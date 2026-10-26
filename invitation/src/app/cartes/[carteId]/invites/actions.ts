"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigerUtilisateur } from "@/lib/auth/session";
import { genererCodeInvite } from "@/lib/invites/code";
import { verifierLimite } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  MAX_INVITES_PAR_CARTE,
  NOM_INVITE_MAX,
  analyserListeNoms,
  dateLimiteSchema,
  inviteUnitaireSchema,
} from "@/lib/validation/invite";

/**
 * Actions serveur de gestion des invités.
 *
 * Règles appliquées dans chaque action :
 *   * `exigerUtilisateur()` : aucune écriture sans session ;
 *   * propriété de la carte vérifiée explicitement, en plus de la RLS ;
 *   * validation Zod de toutes les entrées ;
 *   * génération du code exclusivement côté serveur ;
 *   * aucun code d'invité dans les journaux (ni message ni détails SQL).
 *
 * Le client Supabase est celui de l'utilisateur (cookie de session), jamais
 * la clé `service_role` : la RLS reste une seconde barrière.
 */

export type EtatInvites = {
  erreur?: string;
  succes?: string;
  /**
   * Incrémenté à chaque succès. Le navigateur s'en sert comme `key` pour
   * remonter le formulaire et vider ses champs, sans effet ni double rendu.
   */
  version?: number;
};

const MESSAGE_INDISPONIBLE =
  "Service momentanément indisponible. Réessaie dans un instant.";
const MESSAGE_CARTE_INTROUVABLE = "Carte introuvable.";
const MESSAGE_LIMITE_ATTEINTE = `Cette carte a atteint la limite de ${MAX_INVITES_PAR_CARTE} invités.`;
const MESSAGE_SAISIE_INVALIDE = `Vérifie le nom (${NOM_INVITE_MAX} caractères maximum) et le nombre de places (1 à 20).`;

/** Nombre de tentatives en cas de collision sur la contrainte UNIQUE du code. */
const MAX_TENTATIVES_CODE = 5;

type ClientServeur = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Vérifie que la carte appartient bien à l'utilisateur connecté. */
async function carteAppartientA(
  supabase: ClientServeur,
  carteId: string,
  utilisateurId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("cartes")
    .select("id")
    .eq("id", carteId)
    .eq("organisateur", utilisateurId)
    .maybeSingle();

  return !error && Boolean(data);
}

/** Nombre d'invités déjà enregistrés, ou null en cas de panne. */
async function compterInvites(
  supabase: ClientServeur,
  carteId: string
): Promise<number | null> {
  const { count, error } = await supabase
    .from("invites")
    .select("id", { count: "exact", head: true })
    .eq("carte_id", carteId);

  if (error) {
    console.error("[invites] comptage impossible", error.code ?? "inconnu");
    return null;
  }

  return count ?? 0;
}

/**
 * Insère un lot d'invités avec des codes neufs.
 *
 * Une collision sur `code` fait échouer toute l'insertion (une seule requête,
 * donc aucune ligne partielle). On régénère alors l'ensemble du lot.
 */
async function insererInvites(
  supabase: ClientServeur,
  params: {
    carteId: string;
    noms: string[];
    places: number;
    dateLimite: string | null;
  }
): Promise<boolean> {
  for (let tentative = 0; tentative < MAX_TENTATIVES_CODE; tentative += 1) {
    const lignes = params.noms.map((nom) => ({
      carte_id: params.carteId,
      nom,
      // Le seul endroit où un code est créé. Jamais côté navigateur.
      code: genererCodeInvite(),
      places: params.places,
      date_limite: params.dateLimite,
    }));

    const { error } = await supabase.from("invites").insert(lignes);

    if (!error) return true;

    // 23505 : violation d'unicité, donc collision sur `code`. On réessaie.
    if (error.code === "23505") continue;

    // Important : ne jamais journaliser `error.message` ni `error.details`.
    // PostgREST peut y recopier la valeur du code d'invitation.
    console.error("[invites] insertion refusée", error.code ?? "inconnu");
    return false;
  }

  console.error("[invites] collisions de code répétées");
  return false;
}

/**
 * Ajoute un invité unique.
 * Signature compatible avec `useActionState` : (état précédent, FormData).
 */
export async function ajouterInvite(
  etatPrecedent: EtatInvites,
  formData: FormData
): Promise<EtatInvites> {
  const utilisateur = await exigerUtilisateur();

  const analyse = inviteUnitaireSchema.safeParse({
    carteId: formData.get("carteId"),
    nom: formData.get("nom"),
    places: formData.get("places"),
    dateLimite: String(formData.get("dateLimite") ?? ""),
  });

  if (!analyse.success) return { erreur: MESSAGE_SAISIE_INVALIDE };

  const { carteId, nom, places, dateLimite } = analyse.data;

  const limite = verifierLimite(
    `invites-ajout:${utilisateur.id}`,
    120,
    5 * 60 * 1000
  );
  if (!limite.autorise) {
    return {
      erreur: "Trop d'ajouts. Réessaie dans quelques instants.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (!(await carteAppartientA(supabase, carteId, utilisateur.id))) {
      return { erreur: MESSAGE_CARTE_INTROUVABLE };
    }

    const dejaPresents = await compterInvites(supabase, carteId);
    if (dejaPresents === null) return { erreur: MESSAGE_INDISPONIBLE };
    if (dejaPresents >= MAX_INVITES_PAR_CARTE) {
      return { erreur: MESSAGE_LIMITE_ATTEINTE };
    }

    const insere = await insererInvites(supabase, {
      carteId,
      noms: [nom],
      places,
      dateLimite,
    });

    if (!insere) return { erreur: MESSAGE_INDISPONIBLE };

    revalidatePath(`/cartes/${carteId}/invites`);
    return {
      succes: `« ${nom} » a été ajouté.`,
      version: (etatPrecedent.version ?? 0) + 1,
    };
  } catch {
    return { erreur: MESSAGE_INDISPONIBLE };
  }
}

/**
 * Ajoute plusieurs invités collés un par ligne.
 * Chaque invité reçoit une place et la même date limite facultative.
 */
export async function ajouterInvitesEnLot(
  etatPrecedent: EtatInvites,
  formData: FormData
): Promise<EtatInvites> {
  const utilisateur = await exigerUtilisateur();

  const carteId = z.uuid().safeParse(formData.get("carteId"));
  if (!carteId.success) return { erreur: MESSAGE_CARTE_INTROUVABLE };

  const liste = analyserListeNoms(String(formData.get("liste") ?? ""));
  if (!liste.ok) return { erreur: liste.erreur };

  const dateLimite = dateLimiteSchema.safeParse(
    String(formData.get("dateLimite") ?? "")
  );
  if (!dateLimite.success) return { erreur: "Date limite invalide." };

  const limite = verifierLimite(
    `invites-lot:${utilisateur.id}`,
    60,
    5 * 60 * 1000
  );
  if (!limite.autorise) {
    return { erreur: "Trop d'ajouts. Réessaie dans quelques instants." };
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (!(await carteAppartientA(supabase, carteId.data, utilisateur.id))) {
      return { erreur: MESSAGE_CARTE_INTROUVABLE };
    }

    const dejaPresents = await compterInvites(supabase, carteId.data);
    if (dejaPresents === null) return { erreur: MESSAGE_INDISPONIBLE };

    const restants = Math.max(0, MAX_INVITES_PAR_CARTE - dejaPresents);

    if (restants === 0) return { erreur: MESSAGE_LIMITE_ATTEINTE };

    if (liste.noms.length > restants) {
      return {
        erreur: `Il reste ${restants} place${restants > 1 ? "s" : ""} sur ${MAX_INVITES_PAR_CARTE} pour cette carte. Réduis la liste.`,
      };
    }

    const insere = await insererInvites(supabase, {
      carteId: carteId.data,
      noms: liste.noms,
      places: 1,
      dateLimite: dateLimite.data,
    });

    if (!insere) return { erreur: MESSAGE_INDISPONIBLE };

    revalidatePath(`/cartes/${carteId.data}/invites`);

    return {
      succes:
        liste.noms.length === 1
          ? "1 invité a été ajouté."
          : `${liste.noms.length} invités ont été ajoutés.`,
      version: (etatPrecedent.version ?? 0) + 1,
    };
  } catch {
    return { erreur: MESSAGE_INDISPONIBLE };
  }
}

/**
 * Supprime un invité après vérification de la propriété de la carte.
 * Le code disparaît avec la ligne : le lien ne fonctionne plus.
 */
export async function supprimerInvite(formData: FormData): Promise<void> {
  const utilisateur = await exigerUtilisateur();

  const analyse = z
    .object({ carteId: z.uuid(), inviteId: z.uuid() })
    .safeParse({
      carteId: formData.get("carteId"),
      inviteId: formData.get("inviteId"),
    });

  if (!analyse.success) return;

  const { carteId, inviteId } = analyse.data;

  try {
    const supabase = await createSupabaseServerClient();

    if (!(await carteAppartientA(supabase, carteId, utilisateur.id))) return;

    const { error } = await supabase
      .from("invites")
      .delete()
      .eq("id", inviteId)
      // Le filtre sur la carte empêche de supprimer un invité d'une autre carte
      // même si son identifiant était connu.
      .eq("carte_id", carteId);

    if (error) {
      console.error("[invites] suppression refusée", error.code ?? "inconnu");
      return;
    }

    revalidatePath(`/cartes/${carteId}/invites`);
  } catch {
    // La page reste inchangée : la ligne sera toujours visible après
    // revalidation, l'organisateur peut réessayer.
  }
}
