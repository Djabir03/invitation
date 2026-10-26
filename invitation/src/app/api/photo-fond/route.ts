import { randomUUID } from "node:crypto";

import { z } from "zod";

import { utilisateurCourant } from "@/lib/auth/session";
import {
  detecterFormatImage,
  estExtensionImageAutorisee,
  extensionCompatible,
  MIME_PAR_FORMAT,
} from "@/lib/images/format";
import { convertirEnWebp } from "@/lib/images/webp";
import {
  BUCKET_PHOTOS_FOND,
  DUREE_URL_SIGNEE,
  TAILLE_MAX_PHOTO_OCTETS,
  cheminPhotoFond,
  cheminPhotoValide,
} from "@/lib/photo-fond";
import { verifierLimite } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Envoi de la photo de fond d'une carte.
 *
 * Défenses appliquées, dans cet ordre :
 *   1. session obligatoire (`utilisateurCourant` valide le jeton) ;
 *   2. limitation de débit par utilisateur ;
 *   3. taille maximale de 5 Mo et extension dans la liste blanche ;
 *   4. lecture des octets magiques : le `Content-Type` et l'extension ne sont
 *      jamais crus sur parole ;
 *   5. propriété de la carte vérifiée en base (en plus de la RLS) ;
 *   6. décodage puis ré-encodage WebP par sharp, avec limite de pixels et
 *      suppression des métadonnées ;
 *   7. nom UUID généré par le serveur et chemin `[user]/[carte]/[uuid].webp` ;
 *   8. mise à jour de `photo_fond_chemin`, puis suppression de l'ancienne photo.
 *
 * Les erreurs renvoyées au navigateur restent génériques. Les détails
 * techniques ne vont que dans les journaux du serveur.
 *
 * Le runtime Node.js est celui par défaut des Route Handlers : inutile de
 * déclarer `runtime`, qui est incompatible avec `cacheComponents`.
 */

/** Marge pour les frontières multipart, avant la lecture du fichier. */
const MARGE_FORMULAIRE = 1024 * 1024;

const MESSAGE_FICHIER =
  "Photo refusée. Utilise un JPG, PNG ou WebP de 5 Mo maximum.";
const MESSAGE_INDISPONIBLE =
  "Envoi de la photo impossible pour le moment. Réessaie plus tard.";
const MESSAGE_CARTE_INTROUVABLE = "Carte introuvable.";

const schemaUuid = z.uuid();

const ENTETES = { "Cache-Control": "no-store" };

function json(
  corps: unknown,
  statut = 200,
  entetes: Record<string, string> = {}
): Response {
  return Response.json(corps, {
    status: statut,
    headers: { ...ENTETES, ...entetes },
  });
}

function journaliser(
  message: string,
  details: Record<string, unknown>
): void {
  // Les identifiants sont des UUID et le contenu du fichier n'est jamais loggé.
  console.error(`[photo-fond] ${message}`, details);
}

export async function POST(request: Request): Promise<Response> {
  const utilisateur = await utilisateurCourant();

  if (!utilisateur) {
    return json({ erreur: "Connecte-toi pour envoyer une photo." }, 401);
  }

  // 20 envois par heure et par compte : suffisant pour remplacer une photo,
  // assez bas pour limiter un script qui ferait tourner sharp en boucle.
  const limite = verifierLimite(
    `photo-fond:${utilisateur.id}`,
    20,
    60 * 60 * 1000
  );

  if (!limite.autorise) {
    return json(
      { erreur: "Trop d'envois de photos. Réessaie dans quelques instants." },
      429,
      { "Retry-After": String(limite.reessayerDans) }
    );
  }

  // Refus précoce d'un corps trop volumineux, avant de le charger en mémoire.
  const longueurAnnoncee = Number(request.headers.get("content-length") ?? "");
  if (
    Number.isFinite(longueurAnnoncee) &&
    longueurAnnoncee > TAILLE_MAX_PHOTO_OCTETS + MARGE_FORMULAIRE
  ) {
    return json({ erreur: MESSAGE_FICHIER }, 413);
  }

  let formulaire: FormData;
  try {
    formulaire = await request.formData();
  } catch {
    return json({ erreur: MESSAGE_FICHIER }, 400);
  }

  const carteId = formulaire.get("carteId");
  const fichier = formulaire.get("photo");

  if (typeof carteId !== "string" || !schemaUuid.safeParse(carteId).success) {
    return json({ erreur: MESSAGE_CARTE_INTROUVABLE }, 404);
  }

  if (!(fichier instanceof File)) {
    return json({ erreur: MESSAGE_FICHIER }, 400);
  }

  // L'extension est une première barrière : le format réel est vérifié juste
  // après avec les octets magiques.
  if (!estExtensionImageAutorisee(fichier.name) || fichier.size === 0) {
    return json({ erreur: MESSAGE_FICHIER }, 400);
  }

  if (fichier.size > TAILLE_MAX_PHOTO_OCTETS) {
    return json({ erreur: MESSAGE_FICHIER }, 413);
  }

  let octets: Uint8Array;
  try {
    octets = new Uint8Array(await fichier.arrayBuffer());
  } catch {
    return json({ erreur: MESSAGE_FICHIER }, 400);
  }

  // `fichier.size` peut mentir si le corps a été construit à la main : on
  // revérifie la taille réelle des octets.
  if (octets.length === 0 || octets.length > TAILLE_MAX_PHOTO_OCTETS) {
    return json(
      { erreur: MESSAGE_FICHIER },
      octets.length > TAILLE_MAX_PHOTO_OCTETS ? 413 : 400
    );
  }

  const format = detecterFormatImage(octets);

  if (!format || !extensionCompatible(fichier.name, format)) {
    journaliser("format réel refusé", {
      utilisateur: utilisateur.id,
      carteId,
      taille: octets.length,
      typeAnnonce: fichier.type || "(vide)",
      formatDetecte: format,
    });
    return json({ erreur: MESSAGE_FICHIER }, 400);
  }

  // Le type MIME est fourni par le client : on le compare seulement pour les
  // journaux, jamais pour autoriser l'envoi.
  if (fichier.type && fichier.type !== MIME_PAR_FORMAT[format]) {
    console.warn("[photo-fond] type MIME incohérent (ignoré)", {
      utilisateur: utilisateur.id,
      typeAnnonce: fichier.type,
      formatDetecte: format,
    });
  }

  const supabase = await createSupabaseServerClient();

  // Propriété vérifiée explicitement, en plus de la RLS. Une carte absente et
  // une carte étrangère donnent exactement la même réponse.
  const { data: carte, error: erreurCarte } = await supabase
    .from("cartes")
    // `*` évite une erreur explicite si la migration 0002 n'est pas encore
    // appliquée ; l'update échouera alors proprement plus bas.
    .select("*")
    .eq("id", carteId)
    .eq("organisateur", utilisateur.id)
    .maybeSingle();

  if (erreurCarte || !carte) {
    return json({ erreur: MESSAGE_CARTE_INTROUVABLE }, 404);
  }

  let webp: Buffer;
  try {
    // Le décodage, la limite de pixels, l'orientation EXIF et la suppression
    // des métadonnées sont centralisés dans `convertirEnWebp`.
    webp = await convertirEnWebp(octets);
  } catch (erreur) {
    journaliser("décodage ou ré-encodage refusé", {
      utilisateur: utilisateur.id,
      carteId,
      format,
      taille: octets.length,
      erreur: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return json({ erreur: MESSAGE_FICHIER }, 400);
  }

  // Nom généré par le serveur : le nom d'origine n'est jamais conservé.
  const chemin = cheminPhotoFond(
    utilisateur.id,
    carteId,
    randomUUID()
  );

  const { error: erreurUpload } = await supabase.storage
    .from(BUCKET_PHOTOS_FOND)
    .upload(chemin, webp, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false,
    });

  if (erreurUpload) {
    journaliser("upload Storage impossible", {
      utilisateur: utilisateur.id,
      carteId,
      erreur: erreurUpload.message,
    });
    return json({ erreur: MESSAGE_INDISPONIBLE }, 502);
  }

  const { data: miseAJour, error: erreurMiseAJour } = await supabase
    .from("cartes")
    .update({ photo_fond_chemin: chemin })
    .eq("id", carteId)
    .eq("organisateur", utilisateur.id)
    .select("id")
    .maybeSingle();

  if (erreurMiseAJour || !miseAJour) {
    journaliser("mise à jour de la carte impossible", {
      utilisateur: utilisateur.id,
      carteId,
      erreur: erreurMiseAJour?.message ?? "aucune ligne mise à jour",
    });

    // Le fichier vient d'être créé : on le retire pour ne pas laisser
    // d'orphelin si la base n'a pas accepté le chemin.
    const { error: erreurNettoyage } = await supabase.storage
      .from(BUCKET_PHOTOS_FOND)
      .remove([chemin]);

    if (erreurNettoyage) {
      journaliser("nettoyage du fichier orphelin impossible", {
        chemin,
        erreur: erreurNettoyage.message,
      });
    }

    return json({ erreur: MESSAGE_INDISPONIBLE }, 500);
  }

  // L'ancienne photo est supprimée seulement si son chemin appartient bien à
  // ce compte et à cette carte : jamais de suppression hors du dossier.
  const ancienChemin = carte.photo_fond_chemin;

  if (
    ancienChemin &&
    ancienChemin !== chemin &&
    cheminPhotoValide(ancienChemin, utilisateur.id, carteId)
  ) {
    const { error: erreurSuppression } = await supabase.storage
      .from(BUCKET_PHOTOS_FOND)
      .remove([ancienChemin]);

    if (erreurSuppression) {
      journaliser("suppression de l'ancienne photo impossible", {
        utilisateur: utilisateur.id,
        carteId,
        erreur: erreurSuppression.message,
      });
    }
  } else if (ancienChemin && ancienChemin !== chemin) {
    journaliser("ancien chemin ignoré car invalide", {
      utilisateur: utilisateur.id,
      carteId,
    });
  }

  const { data: urlSignee, error: erreurSignature } = await supabase.storage
    .from(BUCKET_PHOTOS_FOND)
    .createSignedUrl(chemin, DUREE_URL_SIGNEE);

  if (erreurSignature) {
    journaliser("URL signée impossible après l'envoi", {
      utilisateur: utilisateur.id,
      carteId,
      erreur: erreurSignature.message,
    });
  }

  // La photo est bien enregistrée même si l'URL signée échoue : le client
  // affichera un message invitant à recharger la page.
  return json({ ok: true, url: urlSignee?.signedUrl ?? null });
}
