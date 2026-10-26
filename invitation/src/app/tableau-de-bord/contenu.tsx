import Link from "next/link";
import { connection } from "next/server";

import { deconnexion } from "@/lib/auth/actions";
import { exigerUtilisateur } from "@/lib/auth/session";
import { classeBouton } from "../(auth)/ui";

/**
 * Partie dynamique du tableau de bord : lit la session côté serveur.
 * Seul l'e-mail est transmis au rendu, jamais le jeton ni l'identifiant.
 */
export async function ContenuTableauDeBord() {
  // Supabase compare l'expiration du jeton avec Date.now() : on force le rendu
  // à la requête avant cet appel, sinon cacheComponents le voit pendant le
  // prérendu de la coquille statique.
  await connection();

  const utilisateur = await exigerUtilisateur();

  return (
    <div className="w-full max-w-md text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Tableau de bord
      </h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        Connecté en tant que{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {utilisateur.email ?? "adresse inconnue"}
        </span>
      </p>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Choisis un modèle pour créer et personnaliser ta première carte.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href="/modeles"
          className="inline-flex w-full max-w-xs items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Créer une carte
        </Link>
        <form action={deconnexion} className="w-full max-w-xs">
          <button type="submit" className={classeBouton}>
            Se déconnecter
          </button>
        </form>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-500 dark:text-zinc-300 dark:hover:text-zinc-400"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
