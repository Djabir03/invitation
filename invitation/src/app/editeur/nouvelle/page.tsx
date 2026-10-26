import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";

import { exigerUtilisateur } from "@/lib/auth/session";
import { MODELES } from "@/templates";

import { CreationAutomatique } from "./creation-automatique";

export const metadata: Metadata = {
  title: "Nouvelle carte — Invitation",
};

type Proprietes = {
  // Next 16 : searchParams est asynchrone.
  searchParams: Promise<{ modele?: string | string[] }>;
};

/**
 * Point d'entrée « Choisir ce modèle ».
 *
 * La carte est créée par une Server Action déclenchée côté client : un simple
 * préchargement de cette route ne crée donc pas de carte. La page vérifie
 * elle-même la session ; le proxy ne sert que de confort de navigation.
 */
export default function PageNouvelleCarte({ searchParams }: Proprietes) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <Suspense
        fallback={
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Préparation de la carte…
          </p>
        }
      >
        <Preparation searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Preparation({ searchParams }: Proprietes) {
  // Accès aux cookies (session) et aux searchParams : rendu à la requête.
  await connection();

  await exigerUtilisateur();

  const { modele } = await searchParams;
  const identifiant = typeof modele === "string" ? modele : "";
  const modeleValide = MODELES.find((candidat) => candidat.id === identifiant);

  // 404 générique pour un identifiant absent ou inconnu.
  if (!modeleValide) notFound();

  return (
    <CreationAutomatique
      modeleId={modeleValide.id}
      nomModele={modeleValide.nom}
    />
  );
}
