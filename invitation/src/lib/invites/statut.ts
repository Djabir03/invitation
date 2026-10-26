import type { StatutReponse } from "@/lib/invites/types";

/**
 * Affichage du statut de réponse d'un invité.
 *
 * Une réponse absente de la table `reponses` signifie « en attente » : on ne
 * crée pas de ligne tant que l'invité n'a pas répondu.
 */

export function libelleStatut(statut: StatutReponse | null | undefined): string {
  if (statut === "vient") return "Vient";
  if (statut === "ne_vient_pas") return "Ne vient pas";
  return "En attente";
}

export function classeStatut(
  statut: StatutReponse | null | undefined
): string {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";

  if (statut === "vient") {
    return `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200`;
  }

  if (statut === "ne_vient_pas") {
    return `${base} bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200`;
  }

  return `${base} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300`;
}
