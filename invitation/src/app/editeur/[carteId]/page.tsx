import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";

import { exigerUtilisateur } from "@/lib/auth/session";
import { chargerCartePourUtilisateur } from "@/lib/cartes/donnees";

import { EditeurClient } from "./editeur-client";

export const metadata: Metadata = {
  title: "Éditeur de carte — Invitation",
};

type Proprietes = {
  // Next 16 : params est asynchrone.
  params: Promise<{ carteId: string }>;
};

export default function PageEditeur({ params }: Proprietes) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Chargement de l&apos;éditeur…
          </p>
        </main>
      }
    >
      <ContenuEditeur params={params} />
    </Suspense>
  );
}

async function ContenuEditeur({ params }: Proprietes) {
  // La session et la carte sont propres à la requête.
  await connection();

  const utilisateur = await exigerUtilisateur();
  const { carteId } = await params;

  const carte = await chargerCartePourUtilisateur(carteId, utilisateur.id);

  // Carte inexistante, invalide ou appartenant à un autre compte : même 404.
  if (!carte) notFound();

  return (
    <EditeurClient
      carteId={carte.id}
      contenuInitial={carte.contenu}
      photoFondUrlInitial={carte.photoFondUrl}
    />
  );
}
