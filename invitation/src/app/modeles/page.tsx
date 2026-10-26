import type { Metadata } from "next";
import Link from "next/link";

import { MODELES } from "@/templates";
import type { Occasion } from "@/lib/validation/modele";

import { ApercuModele } from "./apercu-modele";

export const metadata: Metadata = {
  title: "Modèles de cartes · Invitation",
  description:
    "Dix modèles de cartes d'invitation prêts à personnaliser : mariage, anniversaire, baptême, cérémonie, soirée, entreprise, diplôme et fêtes.",
};

const LIBELLES_OCCASION: Record<Occasion, string> = {
  mariage: "Mariage",
  anniversaire: "Anniversaire",
  bapteme: "Baptême",
  ceremonie: "Cérémonie",
  soiree: "Soirée",
  entreprise: "Entreprise",
  diplome: "Diplôme",
  fetes: "Fêtes",
};

export default function ModelesPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-14 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-7xl">
        <nav className="mb-10 text-sm">
          <Link
            href="/"
            className="text-zinc-500 underline-offset-4 transition hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            ← Retour à l&apos;accueil
          </Link>
        </nav>

        <header className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Modèles de cartes
          </h1>
          <p className="mt-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Dix modèles prêts à personnaliser. Les textes surlignés — titre,
            date, lieu et message — seront modifiables par l&apos;organisateur.
          </p>
        </header>

        <ul className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {MODELES.map((modele) => (
            <li key={modele.id}>
              <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 transition hover:shadow-md dark:bg-zinc-900 dark:ring-zinc-800">
                <div className="p-4">
                  <ApercuModele modele={modele} />
                </div>

                <div className="flex flex-1 flex-col gap-2 px-5 pb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {LIBELLES_OCCASION[modele.occasion]}
                    </span>
                    {modele.fond.photoObligatoire ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        Photo de fond requise
                      </span>
                    ) : null}
                  </div>

                  <h2 className="text-lg font-semibold tracking-tight">
                    {modele.nom}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {modele.largeur} × {modele.hauteur} px · {modele.elements.length} éléments
                  </p>

                  {/*
                    `prefetch={false}` : la route de création déclenche une
                    Server Action. On évite tout préchargement susceptible de
                    créer une carte sans action de l'organisateur.
                  */}
                  <Link
                    href={`/editeur/nouvelle?modele=${modele.id}`}
                    prefetch={false}
                    className="mt-2 inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Choisir ce modèle
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
