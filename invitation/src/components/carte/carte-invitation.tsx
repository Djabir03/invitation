import type { CSSProperties } from "react";

import { POLICES } from "@/app/modeles/polices";
import type {
  ElementForme,
  ElementModele,
  ElementTexte,
  ModeleCarte,
} from "@/lib/validation/modele";

/**
 * Rendu statique d'une carte, partagé par la galerie, l'aperçu de l'éditeur et
 * la page publique d'un invité.
 *
 * Le modèle est dessiné dans un repère de 1000 x 1400. Les positions sont
 * converties en pourcentages et la taille du texte en `cqw` (pourcentage de la
 * largeur du conteneur) : la carte reste identique à toute échelle.
 *
 * En mode `accessible`, le texte est un vrai contenu DOM (et non une image) :
 * un lecteur d'écran peut parcourir le titre, la date, le lieu et le message.
 * Les formes et la photo sont décoratives et masquées aux technologies
 * d'assistance.
 */

const COULEUR_FORME: Record<ElementForme["forme"], CSSProperties> = {
  rectangle: {},
  cercle: { borderRadius: "50%" },
  losange: { clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" },
  ligne: {},
};

const ALIGNEMENT: Record<
  ElementTexte["alignement"],
  NonNullable<CSSProperties["justifyContent"]>
> = {
  gauche: "flex-start",
  centre: "center",
  droite: "flex-end",
};

const TEXT_ALIGN: Record<
  ElementTexte["alignement"],
  NonNullable<CSSProperties["textAlign"]>
> = {
  gauche: "left",
  centre: "center",
  droite: "right",
};

function position(element: ElementModele, modele: ModeleCarte): CSSProperties {
  return {
    left: `${(element.x / modele.largeur) * 100}%`,
    top: `${(element.y / modele.hauteur) * 100}%`,
    width: `${(element.taille.largeur / modele.largeur) * 100}%`,
    height: `${(element.taille.hauteur / modele.hauteur) * 100}%`,
    transform: `rotate(${element.rotation}deg)`,
  };
}

function Texte({
  element,
  modele,
}: {
  element: ElementTexte;
  modele: ModeleCarte;
}) {
  const style: CSSProperties = {
    ...position(element, modele),
    // 1000 px de largeur de référence : 1 px du modèle vaut 0,1 cqw.
    fontSize: `${(element.taillePolice / modele.largeur) * 100}cqw`,
    color: element.couleur,
    display: "flex",
    alignItems: "center",
    justifyContent: ALIGNEMENT[element.alignement],
    lineHeight: 1.15,
  };

  return (
    <div
      className={`${POLICES[element.police].className} absolute origin-center`}
      style={style}
    >
      <span
        style={{
          width: "100%",
          textAlign: TEXT_ALIGN[element.alignement],
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
        }}
      >
        {element.contenu}
      </span>
    </div>
  );
}

function Forme({
  element,
  modele,
}: {
  element: ElementForme;
  modele: ModeleCarte;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute origin-center"
      style={{
        ...position(element, modele),
        ...COULEUR_FORME[element.forme],
        backgroundColor: element.couleur,
        opacity: element.opacite,
      }}
    />
  );
}

type Proprietes = {
  contenu: ModeleCarte;
  /**
   * URL de la photo de fond (URL signée dans l'éditeur, route de même origine
   * sur la page publique), ou null si la carte n'en a pas.
   */
  photoFondUrl?: string | null;
  /** Expose le texte aux lecteurs d'écran au lieu d'une simple image. */
  accessible?: boolean;
  /** Libellé du groupe accessible. */
  label?: string;
  className?: string;
};

export function CarteInvitation({
  contenu,
  photoFondUrl = null,
  accessible = false,
  label,
  className = "",
}: Proprietes) {
  const description =
    label ??
    (accessible
      ? `Carte d'invitation ${contenu.nom}`
      : `Aperçu du modèle ${contenu.nom}`);

  return (
    <div
      className={`@container relative w-full overflow-hidden rounded-xl ring-1 ring-black/10 ${className}`}
      style={{
        aspectRatio: `${contenu.largeur} / ${contenu.hauteur}`,
        backgroundColor: contenu.fond.couleur,
      }}
      role={accessible ? "group" : "img"}
      aria-label={description}
    >
      {photoFondUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL signée privée et de courte durée, non destinée au cache de next/image.
        <img
          src={photoFondUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
      ) : null}

      {/* Calque coloré posé sur le fond, sous les éléments. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundColor: contenu.calque.couleur,
          opacity: contenu.calque.opacite,
        }}
      />

      {contenu.elements.map((element) =>
        element.type === "texte" ? (
          <Texte key={element.id} element={element} modele={contenu} />
        ) : (
          <Forme key={element.id} element={element} modele={contenu} />
        )
      )}
    </div>
  );
}
