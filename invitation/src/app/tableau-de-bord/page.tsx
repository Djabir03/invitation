import type { Metadata } from "next";
import { Suspense } from "react";

import { ContenuTableauDeBord } from "./contenu";

export const metadata: Metadata = {
  title: "Tableau de bord — Invitation",
};

export default function PageTableauDeBord() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-24 dark:bg-black">
      {/*
        L'accès aux cookies (session) est dynamique. Avec cacheComponents, il
        doit être dans un <Suspense> pour que la coquille de la page reste
        statique. `exigerUtilisateur()` redirige si la session est absente.
      */}
      <Suspense
        fallback={
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Chargement de ton espace…
          </p>
        }
      >
        <ContenuTableauDeBord />
      </Suspense>
    </main>
  );
}
