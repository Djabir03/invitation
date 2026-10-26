"use client";

import imageCompression from "browser-image-compression";
import { useCallback, useEffect, useRef, useState } from "react";

import { estExtensionImageAutorisee } from "@/lib/images/format";
import {
  LARGEUR_MAX_PHOTO,
  LARGEUR_MIN_PHOTO,
  RATIO_PHOTO,
  TAILLE_MAX_PHOTO_OCTETS,
} from "@/lib/photo-fond";

/**
 * Sélecteur, recadreur et envoi de la photo de fond.
 *
 * Le recadrage est fait localement dans un canevas aux proportions exactes de
 * la carte (1000 x 1400). L'image produite est compressée avec
 * `browser-image-compression` (largeur maximale 2000 px) avant l'envoi.
 *
 * Le serveur reste seul juge : il revérifie la taille, l'extension, les octets
 * magiques, la propriété de la carte et ré-encode l'image en WebP.
 */

const APERCU_LARGEUR = 360;
const APERCU_HAUTEUR = Math.round(APERCU_LARGEUR * RATIO_PHOTO);

const MESSAGE_GENERIQUE =
  "Envoi de la photo impossible. Vérifie le fichier et réessaie.";

type Proprietes = {
  carteId: string;
  onPhotoEnvoyee: (url: string) => void;
  onFermer: () => void;
};

type Centre = { x: number; y: number };

function geometrie(
  imageLargeur: number,
  imageHauteur: number,
  zoom: number,
  centre: Centre
) {
  // « cover » : la photo remplit toujours l'aperçu, sans déformation.
  const echelle =
    Math.max(APERCU_LARGEUR / imageLargeur, APERCU_HAUTEUR / imageHauteur) *
    zoom;

  const dw = imageLargeur * echelle;
  const dh = imageHauteur * echelle;

  return {
    dw,
    dh,
    ox: APERCU_LARGEUR / 2 - centre.x * dw,
    oy: APERCU_HAUTEUR / 2 - centre.y * dh,
  };
}

/** Empêche de déplacer la photo au-delà de ses propres bords. */
function bornerCentre(centre: Centre, dw: number, dh: number): Centre {
  const demiLargeur = APERCU_LARGEUR / 2 / dw;
  const demiHauteur = APERCU_HAUTEUR / 2 / dh;

  return {
    x: Math.min(1 - demiLargeur, Math.max(demiLargeur, centre.x)),
    y: Math.min(1 - demiHauteur, Math.max(demiHauteur, centre.y)),
  };
}

function dessiner(
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap,
  zoom: number,
  centre: Centre
): void {
  const contexte = canvas.getContext("2d");
  if (!contexte) return;

  contexte.clearRect(0, 0, canvas.width, canvas.height);
  contexte.fillStyle = "#18181b";
  contexte.fillRect(0, 0, canvas.width, canvas.height);

  const { ox, oy, dw, dh } = geometrie(
    bitmap.width,
    bitmap.height,
    zoom,
    centre
  );

  contexte.drawImage(bitmap, ox, oy, dw, dh);
}

export function PhotoFond({
  carteId,
  onPhotoEnvoyee,
  onFermer,
}: Proprietes) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glisserRef = useRef<{ x: number; y: number } | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);

  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(100);
  const [centre, setCentre] = useState<Centre>({ x: 0.5, y: 0.5 });
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  /** Remplace l'image affichée et libère l'ancien bitmap. */
  const remplacerBitmap = useCallback((nouveau: ImageBitmap | null) => {
    bitmapRef.current?.close();
    bitmapRef.current = nouveau;
    setBitmap(nouveau);
  }, []);

  useEffect(() => {
    return () => {
      bitmapRef.current?.close();
      bitmapRef.current = null;
    };
  }, []);

  // Verrouille le défilement de la page et ferme avec Échap.
  useEffect(() => {
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function surEchap(evenement: KeyboardEvent) {
      if (evenement.key === "Escape" && !envoi) onFermer();
    }

    window.addEventListener("keydown", surEchap);

    return () => {
      document.body.style.overflow = precedent;
      window.removeEventListener("keydown", surEchap);
    };
  }, [envoi, onFermer]);

  // Redessine l'aperçu à chaque changement de zoom ou de cadrage.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;

    dessiner(canvas, bitmap, zoom / 100, centre);
  }, [bitmap, zoom, centre]);

  async function choisirFichier(
    evenement: React.ChangeEvent<HTMLInputElement>
  ) {
    const fichier = evenement.target.files?.[0];
    // Permet de resélectionner le même fichier après une erreur.
    evenement.target.value = "";

    if (!fichier) return;

    setErreur(null);
    setAvertissement(null);

    if (!estExtensionImageAutorisee(fichier.name)) {
      setErreur("Choisis un fichier JPG, PNG ou WebP.");
      return;
    }

    if (fichier.size > TAILLE_MAX_PHOTO_OCTETS) {
      setErreur("La photo ne doit pas dépasser 5 Mo.");
      return;
    }

    try {
      const image = await createImageBitmap(fichier, {
        imageOrientation: "from-image",
      });

      remplacerBitmap(image);
      setZoom(100);
      setCentre({ x: 0.5, y: 0.5 });

      if (image.width < LARGEUR_MIN_PHOTO) {
        setAvertissement(
          `Cette photo fait ${image.width} px de large. Pour un rendu net, une largeur d'au moins ${LARGEUR_MIN_PHOTO} px est recommandée.`
        );
      }
    } catch {
      setErreur("Cette image ne peut pas être lue. Essaie un autre fichier.");
    }
  }

  function changerZoom(valeur: number) {
    const prochainZoom = valeur / 100;

    if (bitmap) {
      const { dw, dh } = geometrie(
        bitmap.width,
        bitmap.height,
        prochainZoom,
        centre
      );
      setCentre((precedent) => bornerCentre(precedent, dw, dh));
    }

    setZoom(valeur);
  }

  function commencerGlisser(evenement: React.PointerEvent<HTMLCanvasElement>) {
    if (!bitmap) return;

    evenement.preventDefault();
    evenement.currentTarget.setPointerCapture(evenement.pointerId);
    glisserRef.current = { x: evenement.clientX, y: evenement.clientY };
  }

  function glisser(evenement: React.PointerEvent<HTMLCanvasElement>) {
    const depart = glisserRef.current;
    if (!depart || !bitmap) return;

    const rectangle = evenement.currentTarget.getBoundingClientRect();
    if (rectangle.width === 0) return;

    // Conversion des pixels CSS vers le repère interne du canevas.
    const facteur = APERCU_LARGEUR / rectangle.width;
    const dx = (evenement.clientX - depart.x) * facteur;
    const dy = (evenement.clientY - depart.y) * facteur;

    glisserRef.current = { x: evenement.clientX, y: evenement.clientY };

    setCentre((precedent) => {
      const { dw, dh } = geometrie(
        bitmap.width,
        bitmap.height,
        zoom / 100,
        precedent
      );

      return bornerCentre(
        { x: precedent.x - dx / dw, y: precedent.y - dy / dh },
        dw,
        dh
      );
    });
  }

  function arreterGlisser() {
    glisserRef.current = null;
  }

  function reinitialiser() {
    setZoom(100);
    setCentre({ x: 0.5, y: 0.5 });
  }

  async function envoyer() {
    if (!bitmap || envoi) return;

    setEnvoi(true);
    setErreur(null);

    try {
      const { ox, oy, dw, dh } = geometrie(
        bitmap.width,
        bitmap.height,
        zoom / 100,
        centre
      );

      // Largeur utile de la zone recadrée, dans les pixels de la source :
      // on ne fabrique pas plus de détails qu'il n'en existe.
      const largeurVisible = bitmap.width * (APERCU_LARGEUR / dw);
      const largeurSortie = Math.min(
        LARGEUR_MAX_PHOTO,
        Math.max(800, Math.round(largeurVisible))
      );
      const hauteurSortie = Math.round(largeurSortie * RATIO_PHOTO);

      const canvas = document.createElement("canvas");
      canvas.width = largeurSortie;
      canvas.height = hauteurSortie;

      const contexte = canvas.getContext("2d");
      if (!contexte) throw new Error("Canevas indisponible.");

      const facteur = largeurSortie / APERCU_LARGEUR;
      contexte.drawImage(
        bitmap,
        ox * facteur,
        oy * facteur,
        dw * facteur,
        dh * facteur
      );

      const blob = await new Promise<Blob | null>((resoudre) => {
        canvas.toBlob(resoudre, "image/webp", 0.9);
      });

      if (!blob) throw new Error("Encodage WebP indisponible.");

      // Compression finale : largeur maximale 2000 px et garantie sous 4 Mo.
      const compresse = await imageCompression(
        new File([blob], "photo.webp", { type: "image/webp" }),
        {
          maxSizeMB: 4,
          maxWidthOrHeight: LARGEUR_MAX_PHOTO,
          fileType: "image/webp",
          initialQuality: 0.82,
          // Pas de worker externe : la compression reste locale et fiable.
          useWebWorker: false,
        }
      );

      const formulaire = new FormData();
      formulaire.append("carteId", carteId);
      formulaire.append("photo", compresse, "photo.webp");

      const reponse = await fetch("/api/photo-fond", {
        method: "POST",
        body: formulaire,
      });

      const resultat = (await reponse.json().catch(() => null)) as {
        url?: string | null;
        erreur?: string;
      } | null;

      if (!reponse.ok) {
        setErreur(resultat?.erreur ?? MESSAGE_GENERIQUE);
        return;
      }

      if (!resultat?.url) {
        setErreur(
          "Photo enregistrée, mais l'aperçu n'a pas pu être chargé. Recharge la page."
        );
        return;
      }

      onPhotoEnvoyee(resultat.url);
      onFermer();
    } catch {
      setErreur(MESSAGE_GENERIQUE);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo de fond"
      className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/80 px-4 py-6"
    >
      <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Photo de fond
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              JPG, PNG ou WebP · 5 Mo maximum · recadrage au format 1000 × 1400.
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            disabled={envoi}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Fermer
          </button>
        </div>

        <div className="mt-5 grid gap-6 sm:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div>
            {bitmap ? (
              <div
                className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-black/20"
                style={{ aspectRatio: "1000 / 1400" }}
              >
                <canvas
                  ref={canvasRef}
                  width={APERCU_LARGEUR}
                  height={APERCU_HAUTEUR}
                  onPointerDown={commencerGlisser}
                  onPointerMove={glisser}
                  onPointerUp={arreterGlisser}
                  onPointerCancel={arreterGlisser}
                  className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
                />
              </div>
            ) : (
              <div
                className="mx-auto flex w-full max-w-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 text-center dark:border-zinc-700 dark:bg-zinc-800"
                style={{ aspectRatio: "1000 / 1400" }}
              >
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Aucune photo sélectionnée.
                </p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  L&apos;aperçu 1000 × 1400 apparaîtra ici.
                </p>
              </div>
            )}

            <input
              id="photo-fond-fichier"
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              onChange={choisirFichier}
              disabled={envoi}
              className="sr-only"
            />
            <label
              htmlFor="photo-fond-fichier"
              className="mt-3 inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {bitmap ? "Choisir une autre photo" : "Choisir une photo"}
            </label>
          </div>

          <div>
            {bitmap ? (
              <>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Photo source : {bitmap.width} × {bitmap.height} px
                </p>

                <label
                  htmlFor="photo-fond-zoom"
                  className="mt-4 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Zoom · {zoom} %
                </label>
                <input
                  id="photo-fond-zoom"
                  type="range"
                  min={100}
                  max={400}
                  step={1}
                  value={zoom}
                  onChange={(evenement) =>
                    changerZoom(Number(evenement.target.value))
                  }
                  className="mt-2 block w-full accent-zinc-900 dark:accent-zinc-100"
                />

                <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Glisse la photo dans l&apos;aperçu pour choisir le cadrage.
                  Utilise le zoom pour t&apos;assurer que les visages ne sont
                  pas coupés.
                </p>

                <button
                  type="button"
                  onClick={reinitialiser}
                  className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Réinitialiser le cadrage
                </button>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Choisis une photo de ton appareil. Elle sera recadrée aux
                proportions de la carte avant d&apos;être compressée et
                envoyée.
              </p>
            )}

            {avertissement ? (
              <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {avertissement}
              </p>
            ) : null}

            {erreur ? (
              <p
                role="alert"
                className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
              >
                {erreur}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={envoyer}
                disabled={!bitmap || envoi}
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {envoi ? "Envoi…" : "Envoyer la photo"}
              </button>
              <button
                type="button"
                onClick={onFermer}
                disabled={envoi}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Annuler
              </button>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              L&apos;image est ré-encodée en WebP par le serveur. Les métadonnées
              (dont la position GPS) sont supprimées et l&apos;ancienne photo est
              effacée.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
