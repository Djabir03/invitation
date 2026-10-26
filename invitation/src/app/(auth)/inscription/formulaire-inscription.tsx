"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { inscription } from "@/lib/auth/actions";
import type { EtatAuth } from "@/lib/auth/etat";

import { BoutonSoumettre } from "../bouton-soumettre";
import { classeChamp, classeErreur, classeLien, classeSucces } from "../ui";

const etatInitial: EtatAuth = {};

export function FormulaireInscription() {
  const [etat, action] = useActionState(inscription, etatInitial);
  const [email, setEmail] = useState("");

  // Si la confirmation d'e-mail est activée, aucun redirect n'a lieu : on
  // remplace le formulaire par la consigne à suivre.
  if (etat.succes) {
    return (
      <div role="status" className={`mt-8 ${classeSucces}`}>
        <p>{etat.succes}</p>
        <Link href="/connexion" className={`mt-3 inline-block ${classeLien}`}>
          Aller à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-5">
      {etat.erreur ? (
        <p role="alert" className={classeErreur}>
          {etat.erreur}
        </p>
      ) : null}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(evenement) => setEmail(evenement.target.value)}
          className={classeChamp}
        />
      </div>

      <div>
        <label
          htmlFor="motDePasse"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Mot de passe
        </label>
        <input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          maxLength={72}
          aria-describedby="aide-mot-de-passe"
          className={classeChamp}
        />
        <p
          id="aide-mot-de-passe"
          className="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
        >
          6 caractères minimum.
        </p>
      </div>

      <div>
        <label
          htmlFor="confirmation"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Confirmer le mot de passe
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          maxLength={72}
          className={classeChamp}
        />
      </div>

      <BoutonSoumettre libelle="Créer mon compte" libelleEnCours="Création…" />
    </form>
  );
}
