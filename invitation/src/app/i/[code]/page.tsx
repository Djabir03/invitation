import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { chargerInvitationPublique } from "@/lib/invitations/donnees";

import { InvitationPublique } from "./invitation-publique";

/**
 * Page publique d'un invité.
 *
 * Elle ne dépend d'aucune session : le lien secret est la seule clé d'accès.
 * La lecture passe exclusivement par le serveur (client `service_role`,
 * fichier `server-only`) ; le navigateur ne reçoit qu'un objet réduit.
 *
 * Le proxy vérifie le format du code, limite le débit par IP et renvoie un
 * vrai 404 pour un code inconnu. La page garde son propre `notFound()` comme
 * seconde barrière : un code invalide ou inconnu affiche la même page
 * « Invitation introuvable », sans indice sur la cause.
 */

/*
 * Pas de `export const dynamic = "force-dynamic"` : avec `cacheComponents`
 * (Next 16), cette option est refusée au build. On la remplace par
 * `instant = false`, qui autorise une route rendue à la demande, sans
 * préchargement. `connection()` ci-dessous force ce rendu dynamique à chaque
 * requête et l'en-tête `Cache-Control: no-store` interdit tout cache partagé :
 * chaque visiteur reçoit sa propre lecture, nominative.
 */
export const instant = false;

export const metadata: Metadata = {
  title: "Votre invitation — Invitation",
  description: "Ouvre ton invitation personnelle.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Proprietes = {
  // Next 16 : params est asynchrone.
  params: Promise<{ code: string }>;
};

export default async function PageInvitation({ params }: Proprietes) {
  // Aucun rendu partagé : la lecture est nominative et faite pour cette
  // requête. `connection()` garantit un rendu à la demande.
  await connection();

  const { code } = await params;

  const invitation = await chargerInvitationPublique(code);

  if (!invitation) notFound();

  return (
    <InvitationPublique
      invitation={invitation}
      // URL de même origine : la route photo signe puis relaie l'image, donc
      // le chemin Storage (qui contient l'identifiant de l'organisateur) et
      // l'URL signée ne parviennent jamais au navigateur.
      photoFondUrl={invitation.photoFondDisponible ? `/i/${code}/photo` : null}
    />
  );
}
