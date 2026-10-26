import { CarteInvitation } from "@/components/carte/carte-invitation";
import type { ModeleCarte } from "@/lib/validation/modele";

/**
 * Aperçu d'un modèle dans la galerie.
 *
 * Le rendu est mutualisé avec l'aperçu de l'éditeur et la page publique d'un
 * invité : une seule implémentation garantit que le modèle présenté est
 * exactement celui qui sera ouvert par les invités.
 */
export function ApercuModele({ modele }: { modele: ModeleCarte }) {
  return <CarteInvitation contenu={modele} />;
}
