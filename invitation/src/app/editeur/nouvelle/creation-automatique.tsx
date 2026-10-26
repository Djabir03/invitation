"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { creerCarteDepuisModele } from "../actions";

/**
 * Déclenche la création une seule fois, depuis le navigateur.
 *
 * Le `useRef` évite la double exécution des effets en mode StrictMode, qui
 * créerait deux cartes. En cas d'échec, on reste sur la page avec un message
 * générique et un lien vers les modèles.
 */
export function CreationAutomatique({
  modeleId,
  nomModele,
}: {
  modeleId: string;
  nomModele: string;
}) {
  const declenche = useRef(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (declenche.current) return;
    declenche.current = true;

    let actif = true;

    void creerCarteDepuisModele(modeleId)
      .then((resultat) => {
        if (!actif) return;

        if ("carteId" in resultat) {
          router.replace(`/editeur/${resultat.carteId}`);
        } else {
          setErreur(resultat.erreur);
        }
      })
      .catch(() => {
        if (actif) {
          setErreur(
            "La création de la carte a échoué. Réessaie depuis la liste des modèles."
          );
        }
      });

    return () => {
      actif = false;
    };
  }, [modeleId, router]);

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {erreur ? (
        <>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Création impossible
          </h1>
          <p
            role="alert"
            className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {erreur}
          </p>
          <Link
            href="/modeles"
            className="mt-6 inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Choisir un autre modèle
          </Link>
        </>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100"
          />
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Création de ta carte…
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Modèle « {nomModele} ». Tu vas être redirigé vers l&apos;éditeur.
          </p>
        </>
      )}
    </div>
  );
}
