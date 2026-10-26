import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";
import { invitationPubliqueExiste } from "@/lib/invitations/donnees";
import { verifierLimite } from "@/lib/rate-limit";
import { OPTIONS_COOKIES_SUPABASE } from "@/lib/supabase-cookies";

/**
 * Rafraîchit la session Supabase à chaque requête et redirige les pages
 * protégées. Ce proxy n'est PAS une frontière de sécurité : chaque page et
 * chaque action serveur revalident l'utilisateur (voir lib/auth/session.ts).
 *
 * Le contrôle de propriété ci-dessous ne sert qu'à produire un vrai statut
 * HTTP 404 : une fois le rendu partiel commencé, un `notFound()` dans la page
 * ne peut plus changer le statut de la réponse.
 */

const PAGES_PROTEGEES = ["/tableau-de-bord", "/editeur", "/cartes"];
const PAGES_AUTH = ["/connexion", "/inscription"];

/** Identifiant de carte accepté : UUID (gen_random_uuid côté Postgres). */
const UUID_CARTE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function correspond(chemin: string, racine: string): boolean {
  return chemin === racine || chemin.startsWith(`${racine}/`);
}

/**
 * Réécrit vers la route interne qui déclenche la page 404 générique.
 *
 * Cette page ne rend rien : elle appelle `notFound()`, donc la réponse porte
 * bien le statut 404, tout en gardant l'URL demandée dans le navigateur.
 */
function reponseIntrouvable(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const destination = request.nextUrl.clone();
  destination.pathname = "/introuvable";
  destination.search = "";

  const redirection = NextResponse.rewrite(destination, { status: 404 });

  // Le proxy a pu rafraîchir le jeton Supabase : les nouveaux cookies doivent
  // accompagner la réponse 404, sinon la session suivante utiliserait un jeton
  // déjà tourné.
  for (const cookie of response.cookies.getAll()) {
    redirection.cookies.set(cookie);
  }

  return redirection;
}

/**
 * En-têtes de la page publique : aucun cache partagé, aucune indexation et
 * aucune fuite du code via le `Referer`.
 */
function entetesInvitation(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive, nosnippet"
  );
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/** Nombre de chargements d'invitation autorisés par IP et par minute. */
const MAX_INVITATIONS_PAR_MINUTE = 30;

/**
 * Adresse IP du client, fournie par la plateforme d'hébergement.
 *
 * Elle ne sert qu'à compter les requêtes. En cas d'absence, toutes les
 * requêtes anonymes partagent le même seau : c'est volontairement prudent.
 */
function adresseIp(request: NextRequest): string {
  const transmise = request.headers.get("x-forwarded-for");
  const ip = transmise
    ? transmise.split(",")[0]?.trim()
    : request.headers.get("x-real-ip")?.trim();

  return ip || "inconnue";
}

/**
 * Réécrit une invitation introuvable vers la 404 du segment `/i`.
 *
 * La destination est constante : le code testé n'est jamais recopié dans
 * l'URL interne, donc jamais journalisé par le routeur.
 */
function reponseInvitationIntrouvable(request: NextRequest): NextResponse {
  const destination = request.nextUrl.clone();
  destination.pathname = "/i/introuvable";
  destination.search = "";

  return entetesInvitation(
    NextResponse.rewrite(destination, { status: 404 })
  );
}

export async function proxy(request: NextRequest) {
  const chemin = request.nextUrl.pathname;

  // Page publique d'invitation : elle ne dépend d'aucune session. On évite
  // l'appel d'authentification Supabase et on applique directement les
  // en-têtes anti-cache / anti-fuite, y compris sur la réponse 404.
  if (correspond(chemin, "/i")) {
    // La photo a sa propre route, qui pose elle-même ses en-têtes (contenu
    // privé, `Cache-Control: no-store`) : le proxy ne les réapplique pas.
    if (/^\/i\/[^/]+\/photo\/?$/.test(chemin)) {
      return NextResponse.next({ request });
    }

    const response = entetesInvitation(NextResponse.next({ request }));

    // Seule la page /i/[code] est contrôlée. /i/introuvable est la cible
    // interne de la 404 (page statique, sans donnée personnelle) : on ne la
    // re-contrôle pas.
    const code = /^\/i\/([^/]+)\/?$/.exec(chemin)?.[1];
    if (!code || code === "introuvable") return response;

    // La limite compte aussi les codes mal formés : sinon un attaquant
    // pourrait tester des chaînes en série sans jamais être freiné.
    const limite = verifierLimite(
      `invitation:${adresseIp(request)}`,
      MAX_INVITATIONS_PAR_MINUTE,
      60 * 1000
    );

    if (!limite.autorise) return reponseInvitationIntrouvable(request);

    // Vérification avant rendu : une fois le flux partiel commencé, la page ne
    // peut plus changer le statut de la réponse. Un code inconnu reçoit donc
    // un vrai 404, identique à celui d'un code mal formé.
    if (!(await invitationPubliqueExiste(code))) {
      return reponseInvitationIntrouvable(request);
    }

    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sans configuration Supabase, on laisse passer : les pages protégées
  // refuseront l'accès d'elles-mêmes. Le proxy ne doit pas faire tomber tout
  // le site à cause d'une variable manquante.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookieOptions: OPTIONS_COOKIES_SUPABASE,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Les cookies mis à jour doivent être propagés à la requête (pour
          // le rendu en cours) ET à la réponse (pour le navigateur).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valide le jeton auprès de Supabase, contrairement à getSession()
  // qui se contente de décoder un cookie potentiellement falsifié.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pageProtegee = PAGES_PROTEGEES.some((racine) =>
    correspond(chemin, racine)
  );
  const pageAuth = PAGES_AUTH.some((racine) => correspond(chemin, racine));

  if (!user && pageProtegee) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/connexion";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  if (user && pageAuth) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/tableau-de-bord";
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  // Une carte inexistante et une carte appartenant à un autre compte doivent
  // produire exactement la même réponse : une 404 générique.
  if (user) {
    // Deux routes portent un identifiant de carte : l'éditeur et la gestion
    // des invités. Le contrôle de propriété est identique pour les deux.
    const identifiantEditeur = /^\/editeur\/([^/]+)\/?$/.exec(chemin)?.[1];
    const identifiantInvites = /^\/cartes\/([^/]+)\/invites\/?$/.exec(
      chemin
    )?.[1];
    const identifiant = identifiantEditeur ?? identifiantInvites;

    if (identifiant && identifiant !== "nouvelle") {
      if (!UUID_CARTE.test(identifiant)) {
        return reponseIntrouvable(request, response);
      }

      // La RLS applique le même filtre que cette requête : le résultat est
      // identique pour une carte absente et pour une carte étrangère.
      const { data, error } = await supabase
        .from("cartes")
        .select("id")
        .eq("id", identifiant)
        .eq("organisateur", user.id)
        .limit(1);

      // En cas d'erreur Supabase, on laisse la page répondre : elle refusera
      // elle aussi la carte, sans transformer une panne en fausse 404.
      if (!error && data.length === 0) {
        return reponseIntrouvable(request, response);
      }
    }
  }

  return response;
}

export const config = {
  // Tout sauf les ressources statiques de Next.js et les fichiers d'images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
