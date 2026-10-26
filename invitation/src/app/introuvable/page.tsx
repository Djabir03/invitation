import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Page introuvable — Invitation",
  robots: { index: false, follow: false },
};

/**
 * Cible interne de réécriture du proxy pour les cartes inaccessibles.
 *
 * La page ne rend rien : `notFound()` affiche la page 404 générique de
 * l'application. Elle est aussi accessible directement, où elle renvoie 404.
 */
export default function PageIntrouvableInterne() {
  notFound();
}
