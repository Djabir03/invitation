import { notFound } from "next/navigation";

/**
 * Cible interne de réécriture du proxy pour une invitation introuvable.
 *
 * Le proxy y réécrit les codes mal formés, inconnus ou trop fréquents. Cette
 * page ne rend rien : `notFound()` produit le statut 404 et affiche l'écran
 * « Invitation introuvable » du segment `/i`. Elle est aussi accessible
 * directement, où elle renvoie 404.
 */
export default function PageInvitationIntrouvable() {
  notFound();
}
