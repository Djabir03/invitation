import "server-only";

/**
 * Limitation de débit en mémoire, à titre de défense en profondeur.
 *
 * Limites : le compteur est propre à chaque instance serveur et se réinitialise
 * au redémarrage / à un cold start. En production multi-instances, il faut le
 * remplacer par un stockage partagé (Upstash Redis, Vercel KV…). Supabase Auth
 * applique par ailleurs ses propres limites sur `/auth/v1/token`.
 *
 * Le but est de ralentir le bourrage d'identifiants et les inscriptions en
 * masse, pas de garantir une quota global.
 */

const MAX_ENTREES = 5_000;

type Seau = {
  tentatives: number;
  reinitialisation: number;
};

const seaux = new Map<string, Seau>();

/** Supprime les seaux expirés quand la table devient trop grande. */
function nettoyer(maintenant: number): void {
  if (seaux.size <= MAX_ENTREES) return;

  for (const [cle, seau] of seaux) {
    if (seau.reinitialisation <= maintenant) {
      seaux.delete(cle);
    }
  }

  // Dernier recours : on retire les entrées les plus anciennes. Un attaquant
  // disposant de nombreuses adresses IP pourrait ainsi évincer son propre
  // seau ; c'est acceptable pour une protection best-effort de MVP.
  while (seaux.size > MAX_ENTREES) {
    const premiereCle = seaux.keys().next().value;
    if (premiereCle === undefined) break;
    seaux.delete(premiereCle);
  }
}

/**
 * Enregistre une tentative pour `cle` et indique si elle est autorisée.
 * @param cle Identifiant du client (adresse IP + action).
 * @param maximum Nombre de tentatives autorisées par fenêtre.
 * @param fenetreMs Durée de la fenêtre en millisecondes.
 */
export function verifierLimite(
  cle: string,
  maximum: number,
  fenetreMs: number
): { autorise: boolean; reessayerDans: number } {
  const maintenant = Date.now();
  const seau = seaux.get(cle);

  if (!seau || seau.reinitialisation <= maintenant) {
    seaux.set(cle, {
      tentatives: 1,
      reinitialisation: maintenant + fenetreMs,
    });
    nettoyer(maintenant);
    return { autorise: true, reessayerDans: 0 };
  }

  if (seau.tentatives >= maximum) {
    return {
      autorise: false,
      reessayerDans: Math.ceil((seau.reinitialisation - maintenant) / 1000),
    };
  }

  seau.tentatives += 1;
  return { autorise: true, reessayerDans: 0 };
}
