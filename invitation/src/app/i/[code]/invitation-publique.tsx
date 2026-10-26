"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CarteInvitation } from "@/components/carte/carte-invitation";
import { libelleStatut } from "@/lib/invites/statut";
import type { InvitationPublique } from "@/lib/invitations/types";

/**
 * Expérience d'ouverture d'une invitation.
 *
 * Trois étapes :
 *   1. `attente`  : la photo et les polices se chargent (aucune enveloppe) ;
 *   2. `enveloppe`: l'enveloppe est affichée avec le nom de l'invité ;
 *   3. `carte`    : la carte est affichée, sans outil d'édition.
 *
 * L'animation GSAP n'utilise que `transform` et `opacity` (pas de 3D, pas de
 * filtre), pour rester fluide sur un téléphone d'entrée de gamme. En cas de
 * préférence « réduire les animations », d'échec de GSAP ou de dépassement du
 * délai, la carte est affichée directement.
 */

type Etape = "attente" | "enveloppe" | "carte";

const DUREE_MAX_ANIMATION = 3000;
const DELAI_PREPARATION = 4000;

const formateurDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  // La date limite est stockée en fin de journée UTC.
  timeZone: "UTC",
});

function formaterDate(iso: string): string {
  return formateurDate.format(new Date(iso));
}

function attendrePolices(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) {
    return Promise.resolve();
  }

  return document.fonts.ready.then(
    () => undefined,
    () => undefined
  );
}

function attendrePhoto(url: string | null): Promise<void> {
  if (!url) return Promise.resolve();

  return new Promise((resolve) => {
    const image = new window.Image();
    image.decoding = "async";

    image.onload = () => {
      if (typeof image.decode !== "function") {
        resolve();
        return;
      }

      image.decode().then(
        () => resolve(),
        () => resolve()
      );
    };

    image.onerror = () => resolve();
    image.src = url;
  });
}

function reduireAnimations(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function InvitationPublique({
  invitation,
  photoFondUrl,
}: {
  invitation: InvitationPublique;
  photoFondUrl: string | null;
}) {
  const [etape, setEtape] = useState<Etape>("attente");
  const enveloppeRef = useRef<HTMLButtonElement>(null);
  const rabatRef = useRef<HTMLDivElement>(null);
  const carteRef = useRef<HTMLDivElement>(null);
  const minuteurSecours = useRef<number | null>(null);
  const animationTerminee = useRef(false);
  const ouvertureLancee = useRef(false);
  const ouverteParGeste = useRef(false);

  // Prépare la photo de fond et les polices avant de montrer l'enveloppe.
  // Un délai maximal évite de bloquer durablement si un fichier ne répond pas.
  useEffect(() => {
    let annule = false;
    let minuteur: number | null = null;

    // En mode « réduire les animations », la carte est affichée directement,
    // sans enveloppe. L'état n'est jamais modifié de façon synchrone dans
    // l'effet : la bascule passe par une microtâche.
    if (reduireAnimations()) {
      Promise.resolve().then(() => {
        if (!annule) setEtape("carte");
      });

      return () => {
        annule = true;
      };
    }

    const preparation = Promise.all([
      attendrePolices(),
      attendrePhoto(photoFondUrl),
    ]);

    const delai = new Promise<void>((resolve) => {
      minuteur = window.setTimeout(resolve, DELAI_PREPARATION);
    });

    Promise.race([preparation, delai]).then(() => {
      if (!annule) setEtape("enveloppe");
    });

    return () => {
      annule = true;
      if (minuteur !== null) window.clearTimeout(minuteur);
    };
  }, [photoFondUrl]);

  const afficherCarte = useCallback(() => {
    if (animationTerminee.current) return;
    animationTerminee.current = true;

    if (minuteurSecours.current !== null) {
      window.clearTimeout(minuteurSecours.current);
      minuteurSecours.current = null;
    }

    // Les styles posés par GSAP sont retirés : la carte retrouve sa mise en
    // page normale, sans transform ni opacité résiduels.
    for (const element of [
      carteRef.current,
      enveloppeRef.current,
      rabatRef.current,
    ]) {
      if (!element) continue;
      element.style.removeProperty("transform");
      element.style.removeProperty("opacity");
      element.style.removeProperty("transform-origin");
    }

    setEtape("carte");
  }, []);

  const ouvrir = useCallback(async () => {
    if (etape !== "enveloppe" || ouvertureLancee.current) return;

    ouvertureLancee.current = true;
    ouverteParGeste.current = true;

    if (reduireAnimations()) {
      afficherCarte();
      return;
    }

    // Filet de sécurité : la carte apparaît au plus tard trois secondes après
    // le geste, même si le module GSAP met du temps à se charger ou si
    // l'animation est suspendue (onglet en arrière-plan, appareil lent).
    minuteurSecours.current = window.setTimeout(
      afficherCarte,
      DUREE_MAX_ANIMATION
    );

    const carte = carteRef.current;
    const enveloppe = enveloppeRef.current;
    const rabat = rabatRef.current;

    if (!carte || !enveloppe || !rabat) {
      afficherCarte();
      return;
    }

    try {
      // Import différé : GSAP n'est téléchargé qu'au moment de l'ouverture.
      const { gsap } = await import("gsap");
      if (animationTerminee.current) return;

      gsap.set(carte, {
        opacity: 0,
        y: 64,
        scale: 0.88,
        transformOrigin: "50% 60%",
      });

      const timeline = gsap.timeline({ onComplete: afficherCarte });

      timeline
        // Le rabat se replie vers le haut (transformation 2D).
        .to(rabat, {
          scaleY: 0,
          duration: 0.5,
          ease: "power2.inOut",
          transformOrigin: "top center",
        })
        // L'enveloppe s'efface légèrement.
        .to(
          enveloppe,
          {
            opacity: 0,
            y: 28,
            scale: 0.96,
            duration: 0.5,
            ease: "power2.in",
          },
          0.4
        )
        // La carte sort de l'enveloppe et grandit.
        .to(
          carte,
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 1.05,
            ease: "power3.out",
          },
          0.55
        );

      // La timeline dure 1,6 s : largement sous le plafond de trois secondes.
    } catch {
      afficherCarte();
    }
  }, [afficherCarte, etape]);

  // Place le focus sur la carte après une ouverture volontaire : un lecteur
  // d'écran annonce alors directement le contenu de l'invitation.
  useEffect(() => {
    if (etape !== "carte" || !ouverteParGeste.current) return;
    carteRef.current?.focus({ preventScroll: true });
  }, [etape]);

  useEffect(() => {
    return () => {
      if (minuteurSecours.current !== null) {
        window.clearTimeout(minuteurSecours.current);
      }
    };
  }, []);

  const carteVisible = etape === "carte";

  return (
    <main
      className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-x-hidden px-4 py-10 text-[#f5efe4]"
      style={{
        background:
          "radial-gradient(circle at 50% 0%, #2b241b 0%, #171410 55%, #0d0c0a 100%)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[#c9a96b]/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-[#8a5a3c]/10 blur-3xl" />
      </div>

      <div className="relative flex w-full max-w-[460px] items-center justify-center">
        <div
          ref={carteRef}
          role="region"
          aria-label={`Carte d'invitation pour ${invitation.nom}`}
          aria-hidden={!carteVisible}
          tabIndex={-1}
          className={`relative w-full outline-none transition-none ${
            carteVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <CarteInvitation
            contenu={invitation.contenu}
            photoFondUrl={photoFondUrl}
            accessible
            label={`Contenu de l'invitation pour ${invitation.nom}`}
            className="shadow-2xl shadow-black/40"
          />

          <div className="mt-4 space-y-1 text-center">
            <p className="text-sm text-[#e4d8c4]">
              Invitation pour{" "}
              <span className="font-medium text-[#f5efe4]">
                {invitation.nom}
              </span>
            </p>
            <p className="text-xs text-[#b7a78f]">
              {invitation.places} place{invitation.places > 1 ? "s" : ""}
              {invitation.dateLimite
                ? ` · Réponse avant le ${formaterDate(invitation.dateLimite)}`
                : ""}
            </p>
            <p className="sr-only">
              Statut de la réponse : {libelleStatut(invitation.statut)}.
            </p>
          </div>
        </div>

        {etape === "attente" ? (
          <div
            role="status"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-xl bg-[#14110d] text-sm text-[#d8cbb6]"
          >
            <span
              aria-hidden="true"
              className="h-9 w-9 animate-spin rounded-full border-2 border-[#c9a96b]/25 border-t-[#c9a96b] motion-reduce:animate-none"
            />
            <span>Préparation de votre invitation…</span>
          </div>
        ) : null}

        {etape === "enveloppe" ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center px-2">
            <button
              ref={enveloppeRef}
              type="button"
              onClick={() => void ouvrir()}
              aria-label={`Ouvrir l'invitation pour ${invitation.nom}`}
              className="group w-full max-w-[390px] cursor-pointer rounded-[22px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e3c98d] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d0c0a]"
            >
              <div
                aria-hidden="true"
                className="relative aspect-[1.5/1] w-full transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
              >
                {/* Corps de l'enveloppe */}
                <div className="absolute inset-0 rounded-[18px] border border-[#c8b89a] bg-[#efe5d2] shadow-[0_28px_60px_-18px_rgba(0,0,0,0.75)]" />

                {/* Rabat supérieur, replié lors de l'ouverture. */}
                <div
                  ref={rabatRef}
                  className="absolute inset-x-0 top-0 h-[62%] origin-top rounded-t-[18px] bg-[#e2d2b7]"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                    boxShadow: "inset 0 -1px 0 rgba(120, 98, 66, 0.25)",
                  }}
                />

                {/* Pli inférieur, purement décoratif. */}
                <div
                  className="absolute inset-x-0 bottom-0 h-[34%] rounded-b-[18px] bg-[#e8dcc7]"
                  style={{
                    clipPath: "polygon(0 100%, 50% 0, 100% 100%)",
                    boxShadow: "inset 0 1px 0 rgba(120, 98, 66, 0.18)",
                  }}
                />

                {/* Étiquette nominative. */}
                <div className="absolute inset-x-0 top-[39%] flex justify-center px-6">
                  <div className="-rotate-1 rounded-md border border-[#d3c5a9] bg-[#fbf6ea] px-5 py-3 text-center shadow-sm">
                    <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#9a8461]">
                      Pour
                    </p>
                    <p className="mt-1 max-w-[280px] break-words font-serif text-xl leading-tight text-[#3f3323]">
                      {invitation.nom}
                    </p>
                  </div>
                </div>

                {/* Cachet décoratif. */}
                <div className="absolute bottom-[13%] left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-[#7d2d35] text-sm text-[#f3e3cd] shadow-inner">
                  ✦
                </div>
              </div>

              <span className="mt-5 block text-center text-sm text-[#e4d8c4]">
                Touchez l&apos;enveloppe pour ouvrir
              </span>
              <span className="mt-1 block text-center text-xs text-[#9f907b]">
                Entrée ou Espace fonctionnent aussi
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
