import "server-only";

import { z } from "zod";

import type { Json } from "@/lib/database.types";
import { lienInvitation, normaliserBaseSite } from "@/lib/invites/lien";
import type {
  DonneesInvites,
  InviteListe,
  StatutReponse,
} from "@/lib/invites/types";
import { MAX_INVITES_PAR_CARTE } from "@/lib/validation/invite";
import { modeleCarteSchema } from "@/lib/validation/modele";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Lecture des invités d'une carte pour son organisateur.
 *
 * La requête filtre explicitement sur `organisateur` avec l'identifiant de la
 * session. La RLS applique la même règle : une carte inexistante et une carte
 * étrangère produisent le même résultat `null`, donc la même 404.
 *
 * Les codes ne sont jamais journalisés. Ils sont convertis en liens complets
 * côté serveur, puis transmis au tableau qui les affiche à l'organisateur.
 */

const schemaUuid = z.uuid();

/** Découpe les identifiants pour rester sous la limite d'URL de PostgREST. */
const TAILLE_TRANCHE_REPONSES = 100;

type LigneInvite = {
  id: string;
  nom: string;
  places: number;
  code: string;
  date_limite: string | null;
};

function baseSitePublique(): string {
  const valeur = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return normaliserBaseSite(valeur || "http://localhost:3000");
}

/**
 * Titre affiché dans le message WhatsApp.
 *
 * On lit l'élément `titre` du modèle enregistré. Si le contenu est illisible
 * (données anciennes, modèle inconnu), on retombe sur le nom du modèle plutôt
 * que d'empêcher l'accès aux invités.
 */
function extraireTitre(contenu: Json): string {
  const resultat = modeleCarteSchema.safeParse(contenu);
  if (!resultat.success) return "notre invitation";

  const element = resultat.data.elements.find((item) => item.id === "titre");

  if (
    element?.type === "texte" &&
    typeof element.contenu === "string" &&
    element.contenu.trim().length > 0
  ) {
    return element.contenu.trim();
  }

  return resultat.data.nom;
}

/**
 * Charge la carte et ses invités.
 * @returns null si la carte est invalide, absente ou appartient à un autre compte.
 */
export async function chargerInvitesPourUtilisateur(
  carteId: string,
  utilisateurId: string
): Promise<DonneesInvites | null> {
  if (!schemaUuid.safeParse(carteId).success) return null;

  const supabase = await createSupabaseServerClient();

  const { data: carte, error: erreurCarte } = await supabase
    .from("cartes")
    .select("id, contenu")
    .eq("id", carteId)
    .eq("organisateur", utilisateurId)
    .maybeSingle();

  if (erreurCarte || !carte) return null;

  const { data: lignes, error: erreurInvites } = await supabase
    .from("invites")
    .select("id, nom, places, code, date_limite")
    .eq("carte_id", carteId)
    // Les ajouts récents apparaissent en premier.
    .order("created_at", { ascending: false });

  if (erreurInvites) {
    // Le code d'erreur seul est sûr : ni le code d'invité ni les détails SQL
    // ne doivent finir dans les journaux.
    console.error("[invites] lecture impossible", erreurInvites.code ?? "inconnu");
    throw new Error("[invites] lecture impossible");
  }

  const invites: LigneInvite[] = lignes ?? [];
  const statuts = new Map<string, StatutReponse>();

  // Les réponses sont lues séparément pour rester compatibles avec les types
  // écrits à la main. On découpe la liste d'identifiants en tranches.
  for (let debut = 0; debut < invites.length; debut += TAILLE_TRANCHE_REPONSES) {
    const tranche = invites
      .slice(debut, debut + TAILLE_TRANCHE_REPONSES)
      .map((invite) => invite.id);

    const { data: reponses, error: erreurReponses } = await supabase
      .from("reponses")
      .select("invite_id, statut")
      .in("invite_id", tranche);

    if (erreurReponses) {
      console.error(
        "[invites] lecture des réponses impossible",
        erreurReponses.code ?? "inconnu"
      );
      throw new Error("[invites] lecture impossible");
    }

    for (const reponse of reponses ?? []) {
      statuts.set(reponse.invite_id, reponse.statut);
    }
  }

  const base = baseSitePublique();

  const invitesAffiches: InviteListe[] = invites.map((invite) => ({
    id: invite.id,
    nom: invite.nom,
    places: invite.places,
    dateLimite: invite.date_limite,
    lien: lienInvitation(invite.code, base),
    statut: statuts.get(invite.id) ?? "en_attente",
  }));

  return {
    carteId: carte.id,
    titre: extraireTitre(carte.contenu),
    invites: invitesAffiches,
    restants: Math.max(0, MAX_INVITES_PAR_CARTE - invitesAffiches.length),
  };
}
