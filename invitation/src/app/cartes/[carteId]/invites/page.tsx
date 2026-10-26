import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";

import { exigerUtilisateur } from "@/lib/auth/session";
import { chargerInvitesPourUtilisateur } from "@/lib/invites/donnees";

import { FormulaireInvites } from "./formulaire-invites";
import { TableauInvites } from "./tableau-invites";

export const metadata: Metadata = {
  title: "Invités — Invitation",
};

type Proprietes = {
  // Next 16 : params est asynchrone.
  params: Promise<{ carteId: string }>;
};

export default function PageInvites({ params }: Proprietes) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Chargement des invités…
          </p>
        </main>
      }
    >
      <ContenuInvites params={params} />
    </Suspense>
  );
}

async function ContenuInvites({ params }: Proprietes) {
  // La session, la carte et la liste sont propres à la requête.
  await connection();

  const utilisateur = await exigerUtilisateur();
  const { carteId } = await params;

  const donnees = await chargerInvitesPourUtilisateur(
    carteId,
    utilisateur.id
  );

  // Carte inexistante, invalide ou appartenant à un autre compte : même 404.
  if (!donnees) notFound();

  return (
    <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="space-y-3">
          <Link
            href={`/editeur/${donnees.carteId}`}
            className="text-sm text-zinc-600 underline-offset-4 transition hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Retour à l&apos;éditeur
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Invités
              </h1>
              <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                {donnees.titre}
              </p>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {donnees.invites.length} / 300 invités
            </p>
          </div>
        </header>

        <FormulaireInvites
          carteId={donnees.carteId}
          restants={donnees.restants}
        />

        <TableauInvites
          carteId={donnees.carteId}
          titre={donnees.titre}
          invites={donnees.invites}
        />

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Chaque invité dispose d&apos;un lien unique de 32 caractères. Le lien
          est la seule clé d&apos;accès à sa réponse : ne le publie pas
          publiquement.
        </p>
      </div>
    </main>
  );
}
