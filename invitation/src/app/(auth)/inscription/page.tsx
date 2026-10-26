import type { Metadata } from "next";
import Link from "next/link";

import { classeLien } from "../ui";
import { FormulaireInscription } from "./formulaire-inscription";

export const metadata: Metadata = {
  title: "Inscription — Invitation",
};

export default function PageInscription() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Créer un compte
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Un compte suffit pour créer et envoyer toutes tes cartes.
      </p>

      <FormulaireInscription />

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className={classeLien}>
          Se connecter
        </Link>
      </p>
    </>
  );
}
