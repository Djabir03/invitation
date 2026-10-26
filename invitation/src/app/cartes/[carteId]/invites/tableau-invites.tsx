"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  lienWhatsApp,
  messageInvitationWhatsApp,
} from "@/lib/invites/lien";
import { classeStatut, libelleStatut } from "@/lib/invites/statut";
import type { InviteListe } from "@/lib/invites/types";

import { supprimerInvite } from "./actions";

/**
 * Tableau des invités.
 *
 * Le lien complet est fourni par le serveur : le code n'est jamais recalculé
 * dans le navigateur. La copie utilise l'API presse-papiers, avec un repli pour
 * les navigateurs qui la refusent. WhatsApp reçoit un message déjà encodé.
 */

const CLASSE_ACTION =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

const CLASSE_DANGER =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950";

const formateurDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  // La date limite est stockée en fin de journée UTC : on l'affiche en UTC
  // pour ne pas décaler le jour selon le fuseau de l'organisateur.
  timeZone: "UTC",
});

function formaterDate(iso: string): string {
  return formateurDate.format(new Date(iso));
}

/** Copie avec repli `execCommand` si l'API presse-papiers est indisponible. */
async function copierTexte(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    // On tente le repli ci-dessous.
  }

  try {
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.style.position = "fixed";
    zone.style.top = "0";
    zone.style.left = "0";
    zone.style.opacity = "0";
    document.body.appendChild(zone);
    zone.select();

    try {
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(zone);
    }
  } catch {
    return false;
  }
}

function BoutonSupprimer({ enCours }: { enCours: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={CLASSE_DANGER}
    >
      {pending ? enCours : "Confirmer"}
    </button>
  );
}

export function TableauInvites({
  carteId,
  titre,
  invites,
}: {
  carteId: string;
  titre: string;
  invites: InviteListe[];
}) {
  const [retourCopie, setRetourCopie] = useState<{
    inviteId: string;
    ok: boolean;
  } | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, []);

  async function copier(invite: InviteListe): Promise<void> {
    const ok = await copierTexte(invite.lien);
    setRetourCopie({ inviteId: invite.id, ok });

    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setRetourCopie(null), 3000);
  }

  return (
    <section aria-labelledby="titre-tableau" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="titre-tableau"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Liste des invités
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {invites.length} invité{invites.length > 1 ? "s" : ""}
        </p>
      </div>

      {retourCopie && !retourCopie.ok ? (
        <p
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          La copie automatique a été refusée par le navigateur. Ouvre le lien
          WhatsApp puis recopie-le depuis le message.
        </p>
      ) : null}

      {invites.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Aucun invité pour le moment. Ajoute un nom pour générer son lien
          personnel.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-950/40">
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <th scope="col" className="px-4 py-3 font-medium">
                  Nom
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Places
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Réponse
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Lien d&apos;invitation
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {invites.map((invite) => {
                const copie =
                  retourCopie?.inviteId === invite.id && retourCopie.ok;
                const message = messageInvitationWhatsApp({
                  nom: invite.nom,
                  titre,
                  lien: invite.lien,
                });

                return (
                  <tr key={invite.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {invite.nom}
                      </p>
                      {invite.dateLimite ? (
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          Réponse avant le {formaterDate(invite.dateLimite)}
                        </p>
                      ) : null}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {invite.places} place{invite.places > 1 ? "s" : ""}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={classeStatut(invite.statut)}>
                        {libelleStatut(invite.statut)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void copier(invite)}
                          aria-label={`Copier le lien de ${invite.nom}`}
                          className={CLASSE_ACTION}
                        >
                          {copie ? "Lien copié" : "Copier le lien"}
                        </button>

                        <a
                          href={lienWhatsApp(message)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Envoyer le lien de ${invite.nom} sur WhatsApp`}
                          className={CLASSE_ACTION}
                        >
                          WhatsApp
                        </a>

                        <form
                          action={supprimerInvite}
                          className="inline-flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="carteId" value={carteId} />
                          <input
                            type="hidden"
                            name="inviteId"
                            value={invite.id}
                          />

                          {aSupprimer === invite.id ? (
                            <>
                              <BoutonSupprimer enCours="Suppression…" />
                              <button
                                type="button"
                                onClick={() => setASupprimer(null)}
                                className={CLASSE_ACTION}
                              >
                                Annuler
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setASupprimer(invite.id)}
                              aria-label={`Supprimer ${invite.nom}`}
                              className={CLASSE_DANGER}
                            >
                              Supprimer
                            </button>
                          )}
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
