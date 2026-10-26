"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";

import { CarteInvitation } from "@/components/carte/carte-invitation";
import { limiteTexte, type ModificationsTexte } from "@/lib/validation/carte";
import {
  POLICES_AUTORISEES,
  type Calque,
  type ElementTexte,
  type ModeleCarte,
  type Police,
} from "@/lib/validation/modele";

import { enregistrerCarte, type EtatEnregistrement } from "../actions";
import { PhotoFond } from "./photo-fond";

/**
 * Éditeur client.
 *
 * Le canevas Konva (qui dépend de `window`) est chargé uniquement côté client
 * avec `next/dynamic` et `ssr: false`. Le reste de l'interface — historique,
 * barre latérale, sauvegarde — reste un composant client classique.
 */

const CanevasEditeur = dynamic(() => import("./canevas-editeur"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
      style={{ aspectRatio: "1000 / 1400" }}
    />
  ),
});

const LIMITE_HISTORIQUE = 50;

const LIBELLES_TEXTES: Record<string, string> = {
  titre: "Titre",
  date: "Date",
  lieu: "Lieu",
  message: "Message",
};

const CLASSE_BOUTON_SECONDAIRE =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

const CLASSE_BOUTON_PRINCIPAL =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200";

type EtatHistorique = {
  passe: ModeleCarte[];
  present: ModeleCarte;
  futur: ModeleCarte[];
};

type ActionHistorique =
  | { type: "modifier"; contenu: ModeleCarte }
  | { type: "annuler" }
  | { type: "retablir" };

function initialiserHistorique(contenu: ModeleCarte): EtatHistorique {
  return { passe: [], present: contenu, futur: [] };
}

function reducerHistorique(
  etat: EtatHistorique,
  action: ActionHistorique
): EtatHistorique {
  switch (action.type) {
    case "modifier":
      if (action.contenu === etat.present) return etat;

      return {
        passe: [...etat.passe, etat.present].slice(-LIMITE_HISTORIQUE),
        present: action.contenu,
        futur: [],
      };

    case "annuler": {
      const precedent = etat.passe[etat.passe.length - 1];
      if (!precedent) return etat;

      return {
        passe: etat.passe.slice(0, -1),
        present: precedent,
        futur: [etat.present, ...etat.futur].slice(0, LIMITE_HISTORIQUE),
      };
    }

    case "retablir": {
      const suivant = etat.futur[0];
      if (!suivant) return etat;

      return {
        passe: [...etat.passe, etat.present].slice(-LIMITE_HISTORIQUE),
        present: suivant,
        futur: etat.futur.slice(1),
      };
    }
  }
}

function libelleTexte(id: string): string {
  return LIBELLES_TEXTES[id] ?? "Texte";
}

function trouverErreurLocale(textes: ElementTexte[]): string | null {
  for (const texte of textes) {
    const libelle = libelleTexte(texte.id);

    if (texte.contenu.trim().length === 0) {
      return `Le texte « ${libelle} » ne peut pas être vide.`;
    }

    const limite = limiteTexte(texte.id);
    if (texte.contenu.length > limite) {
      return `Le texte « ${libelle} » ne peut pas dépasser ${limite} caractères.`;
    }
  }

  return null;
}

export function EditeurClient({
  carteId,
  contenuInitial,
  photoFondUrlInitial,
}: {
  carteId: string;
  contenuInitial: ModeleCarte;
  photoFondUrlInitial: string | null;
}) {
  const [historique, dispatch] = useReducer(
    reducerHistorique,
    contenuInitial,
    initialiserHistorique
  );
  const contenu = historique.present;

  const [selection, setSelection] = useState<string | null>(() => {
    const premier = contenuInitial.elements.find(
      (element) => element.type === "texte" && element.modifiable
    );
    return premier?.id ?? null;
  });
  const [editionDemandee, setEditionDemandee] = useState(0);
  const [apercu, setApercu] = useState(false);
  const [photoFondUrl, setPhotoFondUrl] = useState(photoFondUrlInitial);
  const [photoFondOuverte, setPhotoFondOuverte] = useState(false);
  const [messagePhoto, setMessagePhoto] = useState<string | null>(null);
  const [reference, setReference] = useState<ModeleCarte>(contenuInitial);
  const [etatSauvegarde, setEtatSauvegarde] =
    useState<EtatEnregistrement | null>(null);
  const [enregistrement, demarrerEnregistrement] = useTransition();
  const zoneTexteRef = useRef<HTMLTextAreaElement>(null);

  const textesModifiables = useMemo(
    () =>
      contenu.elements.filter(
        (element): element is ElementTexte =>
          element.type === "texte" && element.modifiable
      ),
    [contenu]
  );

  const texteSelectionne =
    textesModifiables.find((element) => element.id === selection) ?? null;

  const modifie = useMemo(
    () => JSON.stringify(contenu) !== JSON.stringify(reference),
    [contenu, reference]
  );

  const modifierTexte = useCallback(
    (id: string, changements: ModificationsTexte) => {
      setEtatSauvegarde(null);

      dispatch({
        type: "modifier",
        contenu: {
          ...contenu,
          elements: contenu.elements.map((element) =>
            element.id === id &&
            element.type === "texte" &&
            element.modifiable
              ? { ...element, ...changements }
              : element
          ),
        },
      });
    },
    [contenu]
  );

  const demanderEdition = useCallback((id: string) => {
    setSelection(id);
    setEditionDemandee((nombre) => nombre + 1);
  }, []);

  // Le calque est le seul champ global modifiable : il passe par le même
  // historique que les textes et sera validé par le serveur à l'enregistrement.
  const modifierCalque = useCallback(
    (changements: Partial<Calque>) => {
      setEtatSauvegarde(null);

      dispatch({
        type: "modifier",
        contenu: {
          ...contenu,
          calque: { ...contenu.calque, ...changements },
        },
      });
    },
    [contenu]
  );

  const fermerPhotoFond = useCallback(() => {
    setPhotoFondOuverte(false);
  }, []);

  const photoEnvoyee = useCallback((url: string) => {
    setPhotoFondUrl(url);
    setMessagePhoto("Photo de fond mise à jour.");
  }, []);

  const annuler = useCallback(() => {
    setEtatSauvegarde(null);
    dispatch({ type: "annuler" });
  }, []);

  const retablir = useCallback(() => {
    setEtatSauvegarde(null);
    dispatch({ type: "retablir" });
  }, []);

  // Focus du champ de texte après un double-clic sur le canevas. Le compteur
  // force l'effet même si la sélection ne change pas ; aucun setState n'est
  // appelé ici (focus uniquement, sur un système externe).
  useEffect(() => {
    if (editionDemandee === 0) return;

    const zone = zoneTexteRef.current;
    if (!zone) return;

    zone.focus({ preventScroll: true });
    zone.select();
    zone.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [editionDemandee]);

  // Raccourcis Annuler / Rétablir. On laisse le comportement natif dans les
  // champs de saisie pour ne pas perturber l'édition du texte.
  useEffect(() => {
    function surTouche(evenement: KeyboardEvent) {
      const cible = evenement.target;
      if (
        cible instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName)
      ) {
        return;
      }

      if (!(evenement.ctrlKey || evenement.metaKey)) return;

      const touche = evenement.key.toLowerCase();

      if (touche === "z") {
        evenement.preventDefault();
        if (evenement.shiftKey) retablir();
        else annuler();
      } else if (touche === "y") {
        evenement.preventDefault();
        retablir();
      }
    }

    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [annuler, retablir]);

  // Verrouille le défilement et ferme l'aperçu avec Échap.
  useEffect(() => {
    if (!apercu) return;

    const defilementPrecedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function surEchap(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") setApercu(false);
    }

    window.addEventListener("keydown", surEchap);

    return () => {
      document.body.style.overflow = defilementPrecedent;
      window.removeEventListener("keydown", surEchap);
    };
  }, [apercu]);

  // Avertit avant de quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!modifie) return;

    function prevenir(evenement: BeforeUnloadEvent) {
      evenement.preventDefault();
      evenement.returnValue = "";
    }

    window.addEventListener("beforeunload", prevenir);
    return () => window.removeEventListener("beforeunload", prevenir);
  }, [modifie]);

  function enregistrer() {
    const erreurLocale = trouverErreurLocale(textesModifiables);
    if (erreurLocale) {
      setEtatSauvegarde({ succes: false, erreur: erreurLocale });
      return;
    }

    const contenuEnvoye = contenu;
    setEtatSauvegarde(null);

    demarrerEnregistrement(async () => {
      try {
        const resultat = await enregistrerCarte(carteId, contenuEnvoye);
        setEtatSauvegarde(resultat);

        if (resultat.succes) setReference(contenuEnvoye);
      } catch {
        setEtatSauvegarde({
          succes: false,
          erreur: "Enregistrement impossible pour le moment.",
        });
      }
    });
  }

  return (
    <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/tableau-de-bord"
              className="shrink-0 text-sm text-zinc-600 underline-offset-4 transition hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              ← Mon espace
            </Link>

            <div className="min-w-0 border-l border-zinc-200 pl-3 dark:border-zinc-700">
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {contenu.nom}
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${
                    modifie ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
                {modifie
                  ? "Modifications non enregistrées"
                  : "Carte à jour"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={annuler}
              disabled={historique.passe.length === 0}
              aria-label="Annuler"
              title="Annuler (Ctrl+Z)"
              className={CLASSE_BOUTON_SECONDAIRE}
            >
              <span aria-hidden="true">↶</span>
              <span className="hidden sm:inline">Annuler</span>
            </button>

            <button
              type="button"
              onClick={retablir}
              disabled={historique.futur.length === 0}
              aria-label="Rétablir"
              title="Rétablir (Ctrl+Maj+Z)"
              className={CLASSE_BOUTON_SECONDAIRE}
            >
              <span aria-hidden="true">↷</span>
              <span className="hidden sm:inline">Rétablir</span>
            </button>

            <Link
              href={`/cartes/${carteId}/invites`}
              className={CLASSE_BOUTON_SECONDAIRE}
            >
              Invités
            </Link>

            <button
              type="button"
              onClick={() => setApercu(true)}
              className={CLASSE_BOUTON_SECONDAIRE}
            >
              Aperçu
            </button>

            <button
              type="button"
              onClick={enregistrer}
              disabled={enregistrement || !modifie}
              className={CLASSE_BOUTON_PRINCIPAL}
            >
              {enregistrement ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section className="min-w-0" aria-label="Zone de dessin">
          <div className="mx-auto w-full max-w-[620px]">
            <CanevasEditeur
              contenu={contenu}
              photoFondUrl={photoFondUrl}
              elementSelectionne={selection}
              onSelectionner={setSelection}
              onModifier={modifierTexte}
              onDemanderEdition={demanderEdition}
            />
          </div>
          <p className="mx-auto mt-3 max-w-[620px] text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Clique sur un texte pour le sélectionner, glisse-le pour le déplacer
            et utilise les poignées pour le redimensionner. Un double-clic ouvre
            son contenu dans la barre latérale.
          </p>
        </section>

        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <section aria-labelledby="titre-photo-fond">
            <h2
              id="titre-photo-fond"
              className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              Photo de fond
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Ajoute une photo, puis règle le calque posé entre la photo et les
              textes.
            </p>

            <div className="mt-3 flex items-center gap-3">
              {photoFondUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL signée privée et de courte durée, non destinée au cache de next/image.
                <img
                  src={photoFondUrl}
                  alt="Photo de fond actuelle"
                  className="h-20 w-14 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-700"
                />
              ) : (
                <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded border border-dashed border-zinc-300 text-[10px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                  Aucune
                </div>
              )}

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setMessagePhoto(null);
                    setPhotoFondOuverte(true);
                  }}
                  aria-label="Photo de fond"
                  className={`${CLASSE_BOUTON_SECONDAIRE} w-full`}
                >
                  {photoFondUrl ? "Remplacer la photo" : "Photo de fond"}
                </button>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  JPG, PNG ou WebP · 5 Mo max.
                </p>
              </div>
            </div>

            {messagePhoto ? (
              <p
                role="status"
                className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              >
                {messagePhoto}
              </p>
            ) : null}

            <label
              htmlFor="calque-couleur"
              className="mt-4 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Couleur du calque
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="calque-couleur"
                type="color"
                value={contenu.calque.couleur}
                onChange={(evenement) =>
                  modifierCalque({ couleur: evenement.target.value })
                }
                className="h-10 w-16 cursor-pointer rounded border border-zinc-300 bg-transparent p-1 dark:border-zinc-700"
              />
              <code className="text-xs text-zinc-600 dark:text-zinc-300">
                {contenu.calque.couleur}
              </code>
            </div>

            <label
              htmlFor="calque-opacite"
              className="mt-3 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Opacité du calque ·{" "}
              {Math.round(contenu.calque.opacite * 100)} %
            </label>
            <input
              id="calque-opacite"
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(contenu.calque.opacite * 100)}
              onChange={(evenement) =>
                modifierCalque({
                  opacite: Number(evenement.target.value) / 100,
                })
              }
              className="mt-2 block w-full accent-zinc-900 dark:accent-zinc-100"
            />
          </section>

          <div className="my-6 border-t border-zinc-200 dark:border-zinc-700" />

          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Textes modifiables
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {textesModifiables.length} textes — les formes et décors sont figés.
          </p>

          <ul className="mt-3 space-y-2">
            {textesModifiables.map((texte) => {
              const actif = texte.id === selection;

              return (
                <li key={texte.id}>
                  <button
                    type="button"
                    onClick={() => setSelection(texte.id)}
                    aria-pressed={actif}
                    className={`w-full rounded-md border px-3 py-2 text-left transition ${
                      actif
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <span className="block text-[10px] font-medium uppercase tracking-widest opacity-70">
                      {libelleTexte(texte.id)}
                    </span>
                    <span className="mt-0.5 block truncate text-sm">
                      {texte.contenu || "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {texteSelectionne ? (
            <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-700">
              <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Réglages · {libelleTexte(texteSelectionne.id)}
              </h3>

              <label
                htmlFor="texte-contenu"
                className="mt-4 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Contenu
              </label>
              <textarea
                id="texte-contenu"
                ref={zoneTexteRef}
                value={texteSelectionne.contenu}
                maxLength={limiteTexte(texteSelectionne.id)}
                onChange={(evenement) =>
                  modifierTexte(texteSelectionne.id, {
                    contenu: evenement.target.value,
                  })
                }
                rows={4}
                className="mt-1 block w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-700"
              />
              <p className="mt-1 text-right text-[11px] text-zinc-500 dark:text-zinc-400">
                {texteSelectionne.contenu.length} /{" "}
                {limiteTexte(texteSelectionne.id)}
              </p>

              <label
                htmlFor="texte-police"
                className="mt-3 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Police
              </label>
              <select
                id="texte-police"
                value={texteSelectionne.police}
                onChange={(evenement) =>
                  modifierTexte(texteSelectionne.id, {
                    police: evenement.target.value as Police,
                  })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-400 dark:focus:ring-zinc-700"
              >
                {POLICES_AUTORISEES.map((police) => (
                  <option key={police} value={police}>
                    {police}
                  </option>
                ))}
              </select>

              <label
                htmlFor="texte-taille"
                className="mt-3 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Taille du texte · {texteSelectionne.taillePolice} px
              </label>
              <input
                id="texte-taille"
                type="range"
                min={8}
                max={300}
                step={1}
                value={texteSelectionne.taillePolice}
                onChange={(evenement) =>
                  modifierTexte(texteSelectionne.id, {
                    taillePolice: Number(evenement.target.value),
                  })
                }
                className="mt-2 block w-full accent-zinc-900 dark:accent-zinc-100"
              />

              <label
                htmlFor="texte-couleur"
                className="mt-3 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
              >
                Couleur
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="texte-couleur"
                  type="color"
                  value={texteSelectionne.couleur}
                  onChange={(evenement) =>
                    modifierTexte(texteSelectionne.id, {
                      couleur: evenement.target.value,
                    })
                  }
                  className="h-10 w-16 cursor-pointer rounded border border-zinc-300 bg-transparent p-1 dark:border-zinc-700"
                />
                <code className="text-xs text-zinc-600 dark:text-zinc-300">
                  {texteSelectionne.couleur}
                </code>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Position : x {Math.round(texteSelectionne.x)} · y{" "}
                {Math.round(texteSelectionne.y)} · zone{" "}
                {Math.round(texteSelectionne.taille.largeur)} ×{" "}
                {Math.round(texteSelectionne.taille.hauteur)}
              </p>
            </div>
          ) : (
            <p className="mt-6 rounded-md border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Sélectionne un texte sur la carte ou dans la liste pour modifier
              son contenu, sa police, sa taille et sa couleur.
            </p>
          )}

          {contenu.fond.photoObligatoire && !photoFondUrl ? (
            <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Ce modèle attend une photo de fond. Ajoute-la avec le bouton
              « Photo de fond » ci-dessus.
            </p>
          ) : null}

          <div aria-live="polite" className="mt-6">
            {etatSauvegarde ? (
              <p
                role="status"
                className={`rounded-md border px-3 py-2 text-sm ${
                  etatSauvegarde.succes
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                    : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                }`}
              >
                {etatSauvegarde.succes
                  ? "Carte enregistrée."
                  : etatSauvegarde.erreur}
              </p>
            ) : modifie ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Modifications non enregistrées.
              </p>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Carte à jour.
              </p>
            )}
          </div>
        </aside>
      </div>

      {apercu ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu de la carte"
          className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-white sm:px-6">
            <div className="min-w-0">
              <p className="text-sm font-medium">Aperçu</p>
              <p className="truncate text-xs text-zinc-400">{contenu.nom}</p>
            </div>
            <button
              type="button"
              onClick={() => setApercu(false)}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-zinc-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Fermer
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <div
              className="w-full overflow-hidden rounded-lg shadow-2xl"
              style={{ width: "min(92vw, calc(84vh / 1.4))" }}
            >
              {/* Même rendu en lecture seule que la page publique : aucune
                  poignée, aucun écouteur d'édition. */}
              <CarteInvitation
                contenu={contenu}
                photoFondUrl={photoFondUrl}
                accessible
                label={`Aperçu de la carte ${contenu.nom}`}
              />
            </div>
          </div>

          <p className="pb-4 text-center text-xs text-zinc-400">
            Appuie sur Échap pour fermer.
          </p>
        </div>
      ) : null}

      {photoFondOuverte ? (
        <PhotoFond
          carteId={carteId}
          onPhotoEnvoyee={photoEnvoyee}
          onFermer={fermerPhotoFond}
        />
      ) : null}
    </main>
  );
}
