import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/**
 * Client Supabase destiné au navigateur.
 * Il n'utilise que les variables publiques (NEXT_PUBLIC_*).
 * Ne jamais y importer la clé service_role.
 *
 * Attention : les cookies de session sont `httpOnly` (voir supabase-cookies.ts)
 * et ne sont donc pas lisibles par ce client. L'identité de l'organisateur est
 * toujours vérifiée côté serveur ; ne pas s'appuyer sur ce client pour
 * autoriser une action.
 */
export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Variables Supabase publiques manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définies."
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
