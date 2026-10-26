"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { classeChamp } from "@/app/(auth)/ui";
import {
  MAX_INVITES_PAR_CARTE,
  NOM_INVITE_MAX,
  extraireNoms,
} from "@/lib/validation/invite";

import {
  ajouterInvite,
  ajouterInvitesEnLot,
  type EtatInvites,
} from "./actions";

/**
 * Formulaires d'ajout d'invités.
 *
 * Deux modes cohabitent : un invité à la fois (nom, places, date limite) et
 * l'ajout en lot par collage (un nom par ligne). Les champs sont contrôlés
 * pour ne pas perdre la saisie quand le serveur renvoie une erreur.
 *
 * Après un succès, la `version` renvoyée par l'action sert de `key` : le
 * formulaire est remonté avec des champs vides, sans `useEffect` ni setState
 * dans un effet.
 */

const etatInitial: EtatInvites = {};

type DeclencherAction = (formData: FormData) => void;

const CLASSE_BOUTON =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";

const CLASSE_CARTE =
  "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

function BoutonEnvoyer({
  children,
  enCours,
}: {
  children: ReactNode;
  enCours: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={CLASSE_BOUTON}
    >
      {pending ? enCours : children}
    </button>
  );
}

function MessageEtat({ etat }: { etat: EtatInvites }) {
  if (etat.erreur) {
    return (
      <p
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        {etat.erreur}
      </p>
    );
  }

  if (etat.succes) {
    return (
      <p
        role="status"
        className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      >
        {etat.succes}
      </p>
    );
  }

  return null;
}

function FormulaireUnitaire({
  carteId,
  complet,
  etat,
  action,
}: {
  carteId: string;
  complet: boolean;
  etat: EtatInvites;
  action: DeclencherAction;
}) {
  const [nom, setNom] = useState("");
  const [places, setPlaces] = useState("1");
  const [dateLimite, setDateLimite] = useState("");

  return (
    <form action={action} className={CLASSE_CARTE}>
      <fieldset disabled={complet} className="space-y-4">
        <legend className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Un invité
        </legend>

        <input type="hidden" name="carteId" value={carteId} />

        <MessageEtat etat={etat} />

        <div>
          <label
            htmlFor="invite-nom"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Nom de l&apos;invité
          </label>
          <input
            id="invite-nom"
            name="nom"
            type="text"
            required
            maxLength={NOM_INVITE_MAX}
            value={nom}
            onChange={(evenement) => setNom(evenement.target.value)}
            autoComplete="off"
            className={classeChamp}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="invite-places"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Nombre de places
            </label>
            <input
              id="invite-places"
              name="places"
              type="number"
              required
              min={1}
              max={20}
              step={1}
              value={places}
              onChange={(evenement) => setPlaces(evenement.target.value)}
              className={classeChamp}
            />
          </div>

          <div>
            <label
              htmlFor="invite-date"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Date limite{" "}
              <span className="font-normal text-zinc-500">(facultative)</span>
            </label>
            <input
              id="invite-date"
              name="dateLimite"
              type="date"
              value={dateLimite}
              onChange={(evenement) => setDateLimite(evenement.target.value)}
              className={classeChamp}
            />
          </div>
        </div>

        <BoutonEnvoyer enCours="Ajout…">Ajouter l&apos;invité</BoutonEnvoyer>
      </fieldset>
    </form>
  );
}

function FormulaireLot({
  carteId,
  complet,
  etat,
  action,
}: {
  carteId: string;
  complet: boolean;
  etat: EtatInvites;
  action: DeclencherAction;
}) {
  const [liste, setListe] = useState("");
  const [dateLimite, setDateLimite] = useState("");

  const nombreNoms = extraireNoms(liste).length;

  return (
    <form action={action} className={CLASSE_CARTE}>
      <fieldset disabled={complet} className="space-y-4">
        <legend className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Plusieurs invités
        </legend>

        <input type="hidden" name="carteId" value={carteId} />

        <MessageEtat etat={etat} />

        <div>
          <label
            htmlFor="invite-liste"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Liste collée
          </label>
          <textarea
            id="invite-liste"
            name="liste"
            rows={6}
            maxLength={MAX_INVITES_PAR_CARTE * (NOM_INVITE_MAX + 1)}
            value={liste}
            onChange={(evenement) => setListe(evenement.target.value)}
            placeholder={"Awa Diallo\nIbrahim Traoré\nFatou Bâ"}
            className={classeChamp}
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Un nom par ligne. {nombreNoms} nom{nombreNoms > 1 ? "s" : ""}{" "}
            détecté{nombreNoms > 1 ? "s" : ""} · 1 place par invité.
          </p>
        </div>

        <div>
          <label
            htmlFor="invite-date-lot"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Date limite commune{" "}
            <span className="font-normal text-zinc-500">(facultative)</span>
          </label>
          <input
            id="invite-date-lot"
            name="dateLimite"
            type="date"
            value={dateLimite}
            onChange={(evenement) => setDateLimite(evenement.target.value)}
            className={classeChamp}
          />
        </div>

        <BoutonEnvoyer enCours="Ajout…">
          Ajouter {nombreNoms > 0 ? `les ${nombreNoms} invités` : "la liste"}
        </BoutonEnvoyer>
      </fieldset>
    </form>
  );
}

export function FormulaireInvites({
  carteId,
  restants,
}: {
  carteId: string;
  restants: number;
}) {
  const [etatUnitaire, actionUnitaire] = useActionState(
    ajouterInvite,
    etatInitial
  );
  const [etatLot, actionLot] = useActionState(ajouterInvitesEnLot, etatInitial);

  const complet = restants === 0;

  return (
    <section aria-labelledby="titre-formulaires" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="titre-formulaires"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Ajouter des invités
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {restants} place{restants > 1 ? "s" : ""} disponible
          {restants > 1 ? "s" : ""} sur {MAX_INVITES_PAR_CARTE}
        </p>
      </div>

      {complet ? (
        <p
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          La limite de {MAX_INVITES_PAR_CARTE} invités est atteinte pour cette
          carte. Supprime un invité pour en ajouter un autre.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <FormulaireUnitaire
          // Remonte le formulaire (donc vide les champs) après chaque succès.
          key={`unitaire-${etatUnitaire.version ?? 0}`}
          carteId={carteId}
          complet={complet}
          etat={etatUnitaire}
          action={actionUnitaire}
        />

        <FormulaireLot
          key={`lot-${etatLot.version ?? 0}`}
          carteId={carteId}
          complet={complet}
          etat={etatLot}
          action={actionLot}
        />
      </div>
    </section>
  );
}
