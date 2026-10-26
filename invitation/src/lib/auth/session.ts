import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Retourne l'utilisateur authentifié de la requête courante, ou null.
 *
 * `auth.getUser()` vérifie le jeton auprès de Supabase. On ne se contente
 * jamais de `getSession()`, qui lit un cookie potentiellement falsifiable,
 * pour prendre une décision d'autorisation.
 *
 * `cache` mémoïse le résultat pendant le rendu d'une même requête.
 */
export const utilisateurCourant = cache(async (): Promise<User | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) return null;
    return data.user;
  } catch {
    // Configuration manquante ou Supabase injoignable : on refuse l'accès.
    return null;
  }
});

/**
 * Exige un utilisateur connecté. Utilisé dans les pages et, plus tard, dans
 * chaque action serveur qui manipule des données d'organisateur.
 *
 * Le proxy effectue la même redirection en amont, mais cette vérification
 * reste indispensable : le proxy n'est pas une frontière de sécurité.
 */
export async function exigerUtilisateur(): Promise<User> {
  const utilisateur = await utilisateurCourant();

  if (!utilisateur) {
    redirect("/connexion");
  }

  return utilisateur;
}
