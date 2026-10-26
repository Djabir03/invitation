import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page introuvable — Invitation",
};

/** 404 générique : ne révèle jamais l'existence d'une ressource privée. */
export default function PageIntrouvable() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-black">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        Erreur 404
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Page introuvable
      </h1>
      <p className="mt-3 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        La page demandée n&apos;existe pas ou n&apos;est pas accessible.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
