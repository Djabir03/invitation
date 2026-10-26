import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Retour du lien de confirmation d'e-mail Supabase.
 *
 * Deux flux sont acceptés :
 *   - `?code=...` : flux PKCE par défaut, valable dans le navigateur qui a
 *     initié l'inscription (le vérificateur est dans un cookie httpOnly) ;
 *   - `?token_hash=...&type=signup` : flux recommandé par Supabase pour les
 *     liens ouverts sur un autre appareil (téléphone, autre navigateur).
 *     Il nécessite de personnaliser le modèle d'e-mail « Confirm signup »
 *     avec {{ .SiteURL }}/auth/confirmation?token_hash={{ .TokenHash }}&type=signup
 *
 * Dans les deux cas, le jeton est à usage unique et validé par Supabase.
 * Aucune donnée sensible n'est renvoyée en cas d'échec.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  let echec = true;

  if (code || (tokenHash && (type === "signup" || type === "email"))) {
    try {
      const supabase = await createSupabaseServerClient();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        echec = Boolean(error);
      } else if (tokenHash && (type === "signup" || type === "email")) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        echec = Boolean(error);
      }
    } catch {
      echec = true;
    }
  }

  if (!echec) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/tableau-de-bord";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  const destination = request.nextUrl.clone();
  destination.pathname = "/connexion";
  destination.search = "?erreur=confirmation";
  return NextResponse.redirect(destination);
}
