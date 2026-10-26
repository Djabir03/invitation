/**
 * Liens d'invitation et messages WhatsApp.
 *
 * Fonctions pures, sans accès au navigateur : elles sont utilisées côté
 * serveur pour construire l'URL affichée, et côté client pour préparer le
 * message WhatsApp. Le lien contient le code secret de l'invité : il n'est
 * jamais journalisé.
 */

/** Base publique du site, sans slash final. */
export function normaliserBaseSite(base: string): string {
  return base.trim().replace(/\/+$/, "");
}

/**
 * Lien d'invitation d'un invité.
 * @param code Code aléatoire généré côté serveur.
 * @param base URL publique du site (ex. https://invitation.example).
 */
export function lienInvitation(code: string, base: string): string {
  return `${normaliserBaseSite(base)}/i/${code}`;
}

/** Message prérempli proposé à l'organisateur dans WhatsApp. */
export function messageInvitationWhatsApp({
  nom,
  titre,
  lien,
}: {
  nom: string;
  titre: string;
  lien: string;
}): string {
  return `Bonjour ${nom}, voici ton invitation pour ${titre} : ${lien}`;
}

/**
 * URL `wa.me` avec le message déjà encodé.
 * `encodeURIComponent` protège les accents, les espaces, les `&` et les `#`
 * présents dans le titre ou le lien.
 */
export function lienWhatsApp(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
