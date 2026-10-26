import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { OPTIONS_COOKIES_SUPABASE } from "@/lib/supabase-cookies";

/**
 * Client Supabase côté serveur (Server Components, Server Actions, Route Handlers).
 * Il utilise la clé publique et les cookies de l'utilisateur : les politiques RLS
 * s'appliquent donc avec son identité.
 */
export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Variables Supabase publiques manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définies."
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookieOptions: OPTIONS_COOKIES_SUPABASE,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Appelé depuis un Server Component en lecture seule : Next.js interdit
          // l'écriture des cookies. Le middleware ou une Server Action s'en charge.
        }
      },
    },
  });
}
