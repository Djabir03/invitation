import type { Metadata } from "next";

import { InvitationIntrouvable } from "@/components/invitation/invitation-introuvable";

/**
 * Frontière 404 du segment `/i` : page publique d'un invité.
 *
 * Elle couvre `/i/[code]` lorsque `notFound()` est appelé après le début du
 * rendu (par exemple si l'invitation disparaît entre la vérification du proxy
 * et la lecture). L'écran est identique à celui de `/i/introuvable`.
 */
export const metadata: Metadata = {
  title: "Invitation introuvable — Invitation",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function InvitationIntrouvablePage() {
  return <InvitationIntrouvable />;
}
