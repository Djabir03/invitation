import { NextResponse } from "next/server";

import { chargerCheminPhotoPublique } from "@/lib/invitations/donnees";
import { BUCKET_PHOTOS_FOND, DUREE_URL_SIGNEE } from "@/lib/photo-fond";
import { verifierLimite } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Photo de fond de l'invitation publique.
 *
 * Le chemin Storage contient l'identifiant de l'organisateur et celui de la
 * carte : il ne doit jamais parvenir au navigateur. Cette route crée donc une
 * URL signée valable une heure, la consomme côté serveur et relaie l'image.
 *
 * Le navigateur ne reçoit qu'une URL de même origine, sans identifiant interne
 * ni jeton Supabase. Toute anomalie renvoie la même 404, sans détail.
 */

const MAX_PHOTOS_PAR_MINUTE = 120;

function introuvable(): NextResponse {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Adresse IP du client, fournie par la plateforme d'hébergement. */
function adresseIp(request: Request): string {
  const transmise = request.headers.get("x-forwarded-for");
  const ip = transmise
    ? transmise.split(",")[0]?.trim()
    : request.headers.get("x-real-ip")?.trim();

  return ip || "inconnue";
}

type Proprietes = {
  // Next 16 : params est asynchrone.
  params: Promise<{ code: string }>;
};

export async function GET(
  request: Request,
  { params }: Proprietes
): Promise<NextResponse> {
  const limite = verifierLimite(
    `invitation-photo:${adresseIp(request)}`,
    MAX_PHOTOS_PAR_MINUTE,
    60 * 1000
  );

  if (!limite.autorise) return introuvable();

  const { code } = await params;
  const chemin = await chargerCheminPhotoPublique(code);

  if (!chemin) return introuvable();

  try {
    const supabase = createSupabaseAdminClient();

    // URL signée d'une heure, jamais exposée : elle sert uniquement à lire
    // l'objet privé depuis le serveur.
    const { data: signee, error: erreurSignature } = await supabase.storage
      .from(BUCKET_PHOTOS_FOND)
      .createSignedUrl(chemin, DUREE_URL_SIGNEE);

    if (erreurSignature || !signee) {
      // Ni le chemin ni le message Supabase ne sont journalisés.
      console.error("[invitation] signature de la photo impossible");
      return introuvable();
    }

    const image = await fetch(signee.signedUrl, { cache: "no-store" });

    if (!image.ok || !image.body) {
      console.error("[invitation] lecture de la photo impossible");
      return introuvable();
    }

    const entetes = new Headers({
      "Content-Type": image.headers.get("content-type") ?? "image/webp",
      // Image privée : le cache reste strictement local. La règle
      // `Cache-Control: no-store` de next.config.ts pour `/i/:path*` s'applique
      // de toute façon et reste prioritaire.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      "Referrer-Policy": "no-referrer",
    });

    const taille = image.headers.get("content-length");
    if (taille) entetes.set("Content-Length", taille);

    // Le corps est relayé en flux : aucune copie complète en mémoire.
    return new NextResponse(image.body, { status: 200, headers: entetes });
  } catch {
    return introuvable();
  }
}
