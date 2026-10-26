"use client";

import { useActionState, useState } from "react";

import { connexion } from "@/lib/auth/actions";
import type { EtatAuth } from "@/lib/auth/etat";

import { BoutonSoumettre } from "../bouton-soumettre";
import { classeChamp, classeErreur } from "../ui";

const etatInitial: EtatAuth = {};

export function FormulaireConnexion() {
  const [etat, action] = useActionState(connexion, etatInitial);

  // Contrôlé pour conserver l'e-mail saisi après une erreur : React réinitialise
  // les champs non contrôlés à la fin d'une action de formulaire.
  const [email, setEmail] = useState("");

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
          autoComplete="current-password"
          required
          maxLength={72}
          className={classeChamp}
        />
      </div>

      <BoutonSoumettre libelle="Se connecter" libelleEnCours="Connexion…" />
    </form>
  );
}
