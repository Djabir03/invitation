/**
 * Constantes et chemins partagés pour la photo de fond d'une carte.
 *
 * Ce module est volontairement sans dépendance serveur : il est utilisé par la
 * route API, la lecture serveur des cartes et le sélecteur côté navigateur.
 * Les valeurs ci-dessous sont donc l'unique source de vérité pour les limites
 * affichées et pour les contrôles effectués par le serveur.
 */

/** Bucket Supabase Storage privé qui contient les photos de fond. */
export const BUCKET_PHOTOS_FOND = "photos-fond";

/** Taille maximale du fichier reçu, avant tout décodage. */
export const TAILLE_MAX_PHOTO_OCTETS = 5 * 1024 * 1024;

/** Largeur minimale recommandée : en dessous, un avertissement est affiché. */
export const LARGEUR_MIN_PHOTO = 1200;

/** Largeur maximale conservée après recadrage et compression. */
export const LARGEUR_MAX_PHOTO = 2000;

/** Proportions exactes de la carte (1000 x 1400). */
export const RATIO_PHOTO = 1400 / 1000;

/** Durée de validité d'une URL signée, en secondes (une heure). */
export const DUREE_URL_SIGNEE = 60 * 60;

/**
 * Construit le chemin Storage d'une photo.
 *
 * Le nom du fichier est toujours un UUID généré par le serveur : le nom fourni
 * par le navigateur n'est jamais réutilisé. Le premier dossier est
 * l'identifiant de l'utilisateur, ce qui permet aux politiques Storage de
 * limiter chaque compte à son propre espace.
 */
export function cheminPhotoFond(
  utilisateurId: string,
  carteId: string,
  fichierId: string
): string {
  return `${utilisateurId}/${carteId}/${fichierId}.webp`;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vérifie qu'un chemin stocké en base appartient bien à cette carte et à cet
 * utilisateur, et qu'il respecte la forme `[user_id]/[carte_id]/[uuid].webp`.
 *
 * Cette vérification protège la suppression de l'ancienne photo : même si la
 * valeur en base était corrompue, on ne supprime jamais un objet hors du
 * dossier de l'utilisateur.
 */
export function cheminPhotoValide(
  chemin: string,
  utilisateurId: string,
  carteId: string
): boolean {
  const morceaux = chemin.split("/");
  if (morceaux.length !== 3) return false;

  const [dossierUtilisateur, dossierCarte, nom] = morceaux;
  if (!dossierUtilisateur || !dossierCarte || !nom) return false;
  if (!nom.endsWith(".webp")) return false;

  const fichierId = nom.slice(0, -".webp".length);

  return (
    dossierUtilisateur === utilisateurId &&
    dossierCarte === carteId &&
    UUID.test(fichierId)
  );
}
