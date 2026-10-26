import "server-only";

import { z } from "zod";

import {
  BUCKET_PHOTOS_FOND,
  DUREE_URL_SIGNEE,
  cheminPhotoValide,
} from "@/lib/photo-fond";
import type { ModeleCarte } from "@/lib/validation/modele";
import { contenuCarteSchema } from "@/lib/validation/carte";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Lecture d'une carte pour son propriétaire.
 *
 * La requête filtre explicitement sur `organisateur` avec l'identifiant déduit
 * de la session. La RLS applique la même règle : une carte inexistante et une
 * carte appartenant à un autre compte produisent le même résultat `null`, donc
 * la même 404 générique.
 *
 * Le bucket étant privé, la photo est exposée sous forme d'URL signée de
 * courte durée. Aucune URL publique n'est stockée en base.
 */

const schemaUuid = z.uuid();

export type CarteEditable = {
  id: string;
  contenu: ModeleCarte;
  photoFondUrl: string | null;
};

export async function chargerCartePourUtilisateur(
  carteId: string,
  utilisateurId: string
): Promise<CarteEditable | null> {
  if (!schemaUuid.safeParse(carteId).success) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cartes")
    // `select("*")` reste lisible même avant l'application de la migration
    // 0002 : l'éditeur continue de fonctionner, simplement sans photo.
    .select("*")
    .eq("id", carteId)
    .eq("organisateur", utilisateurId)
    .maybeSingle();

  if (error || !data) return null;

  const contenu = contenuCarteSchema.safeParse(data.contenu);

  // Le contenu stocké doit rester cohérent avec le modèle annoncé.
  if (!contenu.success || contenu.data.id !== data.modele) return null;

  let photoFondUrl: string | null = null;

  // Le chemin est revérifié avant de demander une URL signée : une valeur
  // inattendue en base ne doit jamais permettre de lire un autre dossier.
  if (
    data.photo_fond_chemin &&
    cheminPhotoValide(data.photo_fond_chemin, utilisateurId, carteId)
  ) {
    try {
      const { data: signee, error: erreurSignature } = await supabase.storage
        .from(BUCKET_PHOTOS_FOND)
        .createSignedUrl(data.photo_fond_chemin, DUREE_URL_SIGNEE);

      if (!erreurSignature && signee) {
        photoFondUrl = signee.signedUrl;
      } else if (erreurSignature) {
        // La carte reste utilisable même si le Storage est momentanément
        // indisponible : on affiche simplement le fond du modèle.
        console.warn(
          "[photo-fond] URL signée impossible :",
          erreurSignature.message
        );
      }
    } catch (erreur) {
      console.warn("[photo-fond] Storage injoignable :", erreur);
    }
  }

  return { id: data.id, contenu: contenu.data, photoFondUrl };
}
