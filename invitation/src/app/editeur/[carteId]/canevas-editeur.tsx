"use client";

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import {
  Ellipse,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";

import { POLICES } from "@/app/modeles/polices";
import type { ModificationsTexte } from "@/lib/validation/carte";
import {
  POLICES_AUTORISEES,
  type ElementForme,
  type ModeleCarte,
  type Police,
} from "@/lib/validation/modele";

/**
 * Canevas react-konva de l'éditeur.
 *
 * Le modèle est dessiné dans son repère natif (1000 x 1400), puis le calque est
 * mis à l'échelle pour tenir dans la largeur disponible. Les coordonnées
 * manipulées par Konva restent donc celles du modèle : aucun calcul de
 * conversion n'est nécessaire dans les actions d'édition.
 *
 * Seuls les textes marqués `modifiable` écoutent les événements. Les formes et
 * les textes figés sont purement décoratifs.
 */

type Proprietes = {
  contenu: ModeleCarte;
  /** URL signée de la photo de fond, ou null si la carte n'en a pas. */
  photoFondUrl?: string | null;
  elementSelectionne: string | null;
  onSelectionner: (id: string | null) => void;
  onModifier: (id: string, changements: ModificationsTexte) => void;
  onDemanderEdition: (id: string) => void;
  lectureSeule?: boolean;
};

const RAPPORT = 1400 / 1000;

function famillesInitiales(): Record<Police, string> {
  const familles = {} as Record<Police, string>;
  for (const police of POLICES_AUTORISEES) familles[police] = police;
  return familles;
}

/** Forme décorative non interactive. */
function Forme({ element }: { element: ElementForme }) {
  const { largeur, hauteur } = element.taille;
  const centre = {
    x: element.x + largeur / 2,
    y: element.y + hauteur / 2,
    offsetX: largeur / 2,
    offsetY: hauteur / 2,
    rotation: element.rotation,
    fill: element.couleur,
    opacity: element.opacite,
    listening: false,
    perfectDrawEnabled: false,
  };

  if (element.forme === "cercle") {
    return <Ellipse radiusX={largeur / 2} radiusY={hauteur / 2} {...centre} />;
  }

  if (element.forme === "losange") {
    return (
      <Line
        points={[
          largeur / 2,
          0,
          largeur,
          hauteur / 2,
          largeur / 2,
          hauteur,
          0,
          hauteur / 2,
        ]}
        closed
        {...centre}
      />
    );
  }

  return <Rect width={largeur} height={hauteur} {...centre} />;
}

export default function CanevasEditeur({
  contenu,
  photoFondUrl = null,
  elementSelectionne,
  onSelectionner,
  onModifier,
  onDemanderEdition,
  lectureSeule = false,
}: Proprietes) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const [largeur, setLargeur] = useState(0);
  const [familles, setFamilles] = useState(famillesInitiales);
  const [policesPretes, setPolicesPretes] = useState(false);
  // L'URL est mémorisée avec l'image : une ancienne photo n'est jamais
  // affichée pendant le chargement de la suivante.
  const [photoChargee, setPhotoChargee] = useState<{
    url: string;
    image: HTMLImageElement;
  } | null>(null);

  const photo =
    photoFondUrl && photoChargee?.url === photoFondUrl
      ? photoChargee.image
      : null;

  // Charge la photo de fond à partir de son URL signée. Le chargement est
  // annulé si l'URL change (nouvelle photo) ou si le composant est démonté.
  useEffect(() => {
    if (!photoFondUrl) return;

    let annule = false;
    const image = new window.Image();
    image.decoding = "async";

    image.onload = () => {
      if (!annule) setPhotoChargee({ url: photoFondUrl, image });
    };
    image.onerror = () => {
      if (!annule) setPhotoChargee(null);
    };

    image.src = photoFondUrl;

    return () => {
      annule = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [photoFondUrl]);

  // Charge réellement les familles next/font et récupère leur nom interne.
  // Konva ne peut pas utiliser une classe CSS : il lui faut le nom de famille
  // calculé, une fois la feuille de style et les fichiers de police chargés.
  useEffect(() => {
    let annule = false;

    const conteneur = document.createElement("div");
    conteneur.setAttribute("aria-hidden", "true");
    conteneur.style.cssText =
      "position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;";
    document.body.appendChild(conteneur);

    const mesures = new Map<Police, HTMLSpanElement>();

    for (const police of POLICES_AUTORISEES) {
      const span = document.createElement("span");
      span.className = POLICES[police].className;
      span.textContent = "Aa";
      conteneur.appendChild(span);
      mesures.set(police, span);
    }

    const mesurer = () => {
      if (annule) return;

      const trouvees = {} as Record<Police, string>;
      for (const [police, span] of mesures) {
        trouvees[police] = getComputedStyle(span).fontFamily || police;
      }
      setFamilles(trouvees);
    };

    mesurer();

    // Filet de sécurité : on n'attend pas indéfiniment les polices.
    const delai = window.setTimeout(() => {
      if (annule) return;
      mesurer();
      setPolicesPretes(true);
    }, 2500);

    document.fonts.ready
      .then(() => {
        if (annule) return;
        window.clearTimeout(delai);
        mesurer();
        setPolicesPretes(true);
      })
      .catch(() => {
        if (annule) return;
        window.clearTimeout(delai);
        setPolicesPretes(true);
      });

    return () => {
      annule = true;
      window.clearTimeout(delai);
      conteneur.remove();
    };
  }, []);

  // Adapte le canevas à la largeur disponible sans jamais déformer la carte.
  useEffect(() => {
    const element = conteneurRef.current;
    if (!element) return;

    const mesurer = () => setLargeur(element.getBoundingClientRect().width);
    mesurer();

    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  // Attache le Transformer au texte sélectionné et rafraîchit ses poignées
  // quand le contenu, la sélection ou l'échelle change.
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const element = contenu.elements.find(
      (candidat) => candidat.id === elementSelectionne
    );
    const noeud =
      elementSelectionne && stageRef.current
        ? stageRef.current.findOne<Konva.Text>(`#${elementSelectionne}`)
        : null;

    if (
      !lectureSeule &&
      noeud &&
      element?.type === "texte" &&
      element.modifiable
    ) {
      transformer.nodes([noeud]);
    } else {
      transformer.nodes([]);
    }

    transformer.getLayer()?.batchDraw();
  }, [contenu, elementSelectionne, largeur, lectureSeule, policesPretes]);

  const hauteur = Math.round(largeur * RAPPORT);
  const echelle = largeur > 0 ? largeur / contenu.largeur : 1;

  // Les poignées du Transformer vivent dans le calque mis à l'échelle. On
  // compense cette échelle pour garder une cible tactile d'environ 18 px.
  const taillePoignee = 18 / echelle;
  const epaisseurTrait = 2 / echelle;

  return (
    <div
      ref={conteneurRef}
      role="group"
      aria-label={
        lectureSeule
          ? `Aperçu de la carte ${contenu.nom}`
          : `Canevas de la carte ${contenu.nom}`
      }
      className="relative w-full overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/10"
      style={{
        aspectRatio: `${contenu.largeur} / ${contenu.hauteur}`,
        backgroundColor: contenu.fond.couleur,
      }}
    >
      {largeur > 0 && policesPretes ? (
        <Stage
          ref={stageRef}
          width={largeur}
          height={hauteur}
          listening={!lectureSeule}
          onMouseDown={(evenement) => {
            if (evenement.target === evenement.target.getStage()) {
              onSelectionner(null);
            }
          }}
          onTouchStart={(evenement) => {
            if (evenement.target === evenement.target.getStage()) {
              onSelectionner(null);
            }
          }}
        >
          <Layer scaleX={echelle} scaleY={echelle}>
            <Rect
              x={0}
              y={0}
              width={contenu.largeur}
              height={contenu.hauteur}
              fill={contenu.fond.couleur}
              listening={false}
            />

            {/* Photo au-dessus de la couleur de fond, sous le calque et les
                textes : le calque reste ainsi réglable entre les deux. */}
            {photo ? (
              <KonvaImage
                image={photo}
                x={0}
                y={0}
                width={contenu.largeur}
                height={contenu.hauteur}
                listening={false}
              />
            ) : null}

            <Rect
              x={0}
              y={0}
              width={contenu.largeur}
              height={contenu.hauteur}
              fill={contenu.calque.couleur}
              opacity={contenu.calque.opacite}
              listening={false}
            />

            {contenu.elements.map((element) =>
              element.type === "texte" ? (
                <Text
                  key={element.id}
                  id={element.id}
                  x={element.x}
                  y={element.y}
                  width={element.taille.largeur}
                  height={element.taille.hauteur}
                  text={element.contenu}
                  fontFamily={familles[element.police]}
                  fontSize={element.taillePolice}
                  fill={element.couleur}
                  align={element.alignement}
                  verticalAlign="middle"
                  lineHeight={1.15}
                  wrap="word"
                  rotation={element.rotation}
                  listening={!lectureSeule && element.modifiable}
                  draggable={!lectureSeule && element.modifiable}
                  onClick={() => onSelectionner(element.id)}
                  onTap={() => onSelectionner(element.id)}
                  onDblClick={() => onDemanderEdition(element.id)}
                  onDblTap={() => onDemanderEdition(element.id)}
                  onMouseEnter={(evenement) => {
                    const stage = evenement.target.getStage();
                    if (stage) stage.container().style.cursor = "grab";
                  }}
                  onMouseLeave={(evenement) => {
                    const stage = evenement.target.getStage();
                    if (stage) stage.container().style.cursor = "default";
                  }}
                  onDragStart={(evenement) => {
                    const stage = evenement.target.getStage();
                    if (stage) stage.container().style.cursor = "grabbing";
                  }}
                  onDragEnd={(evenement) => {
                    const noeud = evenement.target as Konva.Text;
                    const stage = noeud.getStage();
                    if (stage) stage.container().style.cursor = "grab";

                    onModifier(element.id, {
                      x: Math.round(noeud.x()),
                      y: Math.round(noeud.y()),
                    });
                  }}
                  onTransformEnd={(evenement) => {
                    const noeud = evenement.target as Konva.Text;

                    const nouvelleLargeur = Math.min(
                      contenu.largeur,
                      Math.max(60, noeud.width() * noeud.scaleX())
                    );
                    const nouvelleHauteur = Math.min(
                      contenu.hauteur,
                      Math.max(40, noeud.height() * noeud.scaleY())
                    );
                    const x = Math.min(
                      Math.max(noeud.x(), 0),
                      contenu.largeur - nouvelleLargeur
                    );
                    const y = Math.min(
                      Math.max(noeud.y(), 0),
                      contenu.hauteur - nouvelleHauteur
                    );

                    noeud.width(nouvelleLargeur);
                    noeud.height(nouvelleHauteur);
                    noeud.scaleX(1);
                    noeud.scaleY(1);

                    onModifier(element.id, {
                      x: Math.round(x),
                      y: Math.round(y),
                      taille: {
                        largeur: Math.round(nouvelleLargeur),
                        hauteur: Math.round(nouvelleHauteur),
                      },
                    });
                  }}
                  dragBoundFunc={(position) => {
                    const maxX = Math.max(
                      0,
                      (contenu.largeur - element.taille.largeur) * echelle
                    );
                    const maxY = Math.max(
                      0,
                      (contenu.hauteur - element.taille.hauteur) * echelle
                    );

                    return {
                      x: Math.min(Math.max(position.x, 0), maxX),
                      y: Math.min(Math.max(position.y, 0), maxY),
                    };
                  }}
                />
              ) : (
                <Forme key={element.id} element={element} />
              )
            )}

            {!lectureSeule ? (
              <Transformer
                ref={transformerRef}
                rotateEnabled={false}
                flipEnabled={false}
                keepRatio={false}
                anchorSize={taillePoignee}
                anchorCornerRadius={taillePoignee / 2}
                anchorStrokeWidth={epaisseurTrait}
                anchorStroke="#2563eb"
                anchorFill="#ffffff"
                borderStroke="#2563eb"
                borderStrokeWidth={epaisseurTrait}
                borderDash={[epaisseurTrait * 3, epaisseurTrait * 2]}
                padding={epaisseurTrait * 2}
                ignoreStroke
                boundBoxFunc={(ancien, nouveau) =>
                  nouveau.width < 40 || nouveau.height < 40 ? ancien : nouveau
                }
              />
            ) : null}
          </Layer>
        </Stage>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-zinc-500">
          Préparation du canevas…
        </div>
      )}

      <p className="sr-only">
        Sélectionne un texte pour le déplacer ou le redimensionner. Un double-clic
        ouvre son contenu dans la barre latérale.
      </p>
    </div>
  );
}
