"use client";

import { useFormStatus } from "react-dom";

import { classeBouton } from "./ui";

/**
 * Bouton de soumission avec état « en cours ».
 * `useFormStatus` doit être appelé depuis un composant enfant du <form>.
 */
export function BoutonSoumettre({
  libelle,
  libelleEnCours,
}: {
  libelle: string;
  libelleEnCours: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`${classeBouton} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? libelleEnCours : libelle}
    </button>
  );
}
