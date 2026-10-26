import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { classeLien } from "../ui";
import { FormulaireConnexion } from "./formulaire-connexion";

export const metadata: Metadata = {
  title: "Connexion — Invitation",
};

type Proprietes = {
  // Next 16 : searchParams est asynchrone.
  searchParams: Promise<{ erreur?: string }>;
};

export default function PageConnexion({ searchParams }: Proprietes) {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Connexion
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Accède à ton espace organisateur.
      </p>

      {/*
        La lecture de searchParams est dynamique : avec cacheComponents, elle
        doit être isolée dans un <Suspense> pour que la coquille statique de la
        page reste prérendue.
      */}
      <Suspense fallback={null}>
        <MessageConfirmation searchParams={searchParams} />
      </Suspense>

      <FormulaireConnexion />

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className={classeLien}>
          Créer un compte
        </Link>
      </p>
    </>
  );
}

/** Affiche un message générique si le lien de confirmation a échoué. */
async function MessageConfirmation({ searchParams }: Proprietes) {
  const { erreur } = await searchParams;

  if (erreur !== "confirmation") return null;

  return (
    <p
      role="alert"
      className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      Le lien de confirmation est invalide ou a expiré. Réessaie
      l&apos;inscription pour recevoir un nouvel e-mail.
    </p>
  );
}
