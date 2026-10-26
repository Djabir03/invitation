import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase privilégié (clé service_role).
 *
 * - Ce fichier importe "server-only" : toute tentative d'import depuis un
 *   composant client provoquera une erreur de build.
 * - La clé service_role contourne RLS : elle ne doit être utilisée que pour des
 *   opérations administratives strictement nécessaires, côté serveur.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Variables Supabase administrateur manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
