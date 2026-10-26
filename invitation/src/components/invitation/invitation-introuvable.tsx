import Link from "next/link";

/**
 * Écran unique affiché pour une invitation inaccessible.
 *
 * Il est utilisé par la route interne `/i/introuvable` (cible de la
 * réécriture 404 du proxy) et par la frontière `not-found` du segment `/i`.
 * Le texte reste volontairement identique pour un code mal formé, un code
 * inconnu et une limitation de débit : aucun indice sur la cause.
 */
export function InvitationIntrouvable() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0d0c0a] px-6 text-center text-[#f5efe4]">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#b7a78f]">
        Erreur 404
      </p>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        Invitation introuvable
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[#c9bca8]">
        Ce lien n&apos;est pas valide ou n&apos;existe plus. Vérifie qu&apos;il
        a été copié en entier, ou demande un nouveau lien à la personne qui
        t&apos;a invité.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-10 items-center justify-center rounded-md border border-[#4a4033] px-5 py-2 text-sm font-medium text-[#f5efe4] transition hover:bg-[#211c16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e3c98d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0c0a]"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
