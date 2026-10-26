import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  contenuCarteSchema,
  LIMITE_ELEMENTS,
  verifierContenuCarte,
} from "../src/lib/validation/carte.ts";
import {
  modeleCarteSchema,
  type ElementModele,
  type ElementTexte,
  type ModeleCarte,
} from "../src/lib/validation/modele.ts";

/**
 * Tests du contenu enregistré d'une carte.
 *
 * Le contenu est un instantané du modèle : l'éditeur ne doit pouvoir modifier
 * que les textes `modifiable`, et seulement leurs champs autorisés. Le serveur
 * refuse tout le reste (fond, calque, formes, agencement, ajout d'élément…).
 */

const FICHIER = fileURLToPath(
  new URL("../src/templates/mariage-classique.json", import.meta.url)
);

const modele: ModeleCarte = modeleCarteSchema.parse(
  JSON.parse(readFileSync(FICHIER, "utf8"))
);

/** Copie profonde : chaque test travaille sur son propre contenu. */
function copie(): ModeleCarte {
  return structuredClone(modele);
}

function texteModifiable(contenu: ModeleCarte): ElementTexte {
  const texte = contenu.elements.find(
    (element): element is ElementTexte =>
      element.type === "texte" && element.modifiable
  );

  assert.ok(texte, "Le modèle de test doit contenir un texte modifiable.");
  return texte;
}

function remplacer(
  contenu: ModeleCarte,
  id: string,
  changement: Partial<ElementModele>
): ModeleCarte {
  return {
    ...contenu,
    elements: contenu.elements.map((element) =>
      element.id === id ? ({ ...element, ...changement } as ElementModele) : element
    ),
  };
}

test("le contenu initial des dix modèles est valide", () => {
  const resultat = contenuCarteSchema.safeParse(modele);
  assert.equal(resultat.success, true);
});

test("les modifications autorisées d'un texte modifiable sont acceptées", () => {
  const contenu = copie();
  const texte = texteModifiable(contenu);

  const modifie = remplacer(contenu, texte.id, {
    contenu: "Un nouveau titre",
    police: "Poppins",
    taillePolice: 64,
    couleur: "#123456",
    x: 12,
    y: 34,
    taille: { largeur: 600, hauteur: 200 },
  });

  const resultat = verifierContenuCarte(modele, modifie);
  assert.equal(resultat.ok, true);

  if (resultat.ok) {
    const apres = resultat.contenu.elements.find(
      (element) => element.id === texte.id
    );
    assert.equal(apres?.type, "texte");
    if (apres?.type === "texte") {
      assert.equal(apres.contenu, "Un nouveau titre");
      assert.equal(apres.police, "Poppins");
      assert.equal(apres.couleur, "#123456");
    }
  }
});

test("un texte trop long est refusé", () => {
  const contenu = copie();
  const texte = texteModifiable(contenu);

  // 121 caractères : au-delà de la limite du titre (120), sous celle du schéma.
  const trop = remplacer(contenu, texte.id, { contenu: "a".repeat(121) });

  assert.equal(contenuCarteSchema.safeParse(trop).success, false);
  assert.equal(verifierContenuCarte(modele, trop).ok, false);
});

test("un texte vide ou composé d'espaces est refusé", () => {
  const contenu = copie();
  const texte = texteModifiable(contenu);

  for (const valeur of ["", "   "]) {
    const vide = remplacer(contenu, texte.id, { contenu: valeur });
    assert.equal(verifierContenuCarte(modele, vide).ok, false, valeur);
  }
});

test("plus de 80 éléments sont refusés", () => {
  const contenu = copie();
  const modeleElement = contenu.elements[0];
  assert.ok(modeleElement);

  const elements: ElementModele[] = Array.from(
    { length: LIMITE_ELEMENTS + 1 },
    (_, index) => ({ ...modeleElement, id: `element-${index}` })
  );

  const trop = { ...contenu, elements };
  assert.equal(contenuCarteSchema.safeParse(trop).success, false);
  assert.equal(verifierContenuCarte(modele, trop).ok, false);
});

test("une police hors liste blanche ou une couleur invalide est refusée", () => {
  const contenu = copie();
  const texte = texteModifiable(contenu);

  const policeInvalide = remplacer(contenu, texte.id, {
    police: "Comic Sans MS" as ElementTexte["police"],
  });
  assert.equal(verifierContenuCarte(modele, policeInvalide).ok, false);

  const couleurInvalide = remplacer(contenu, texte.id, {
    couleur: "rouge",
  });
  assert.equal(verifierContenuCarte(modele, couleurInvalide).ok, false);
});

test("la modification d'un élément non modifiable est refusée", () => {
  const contenu = copie();
  const figé = contenu.elements.find(
    (element) => element.type === "texte" && !element.modifiable
  );

  assert.ok(figé, "Le modèle de test doit contenir un texte figé.");
  const altere = remplacer(contenu, figé.id, { contenu: "Détourné" });

  assert.equal(verifierContenuCarte(modele, altere).ok, false);
});

test("la modification du fond et de l'agencement est refusée", () => {
  const contenu = copie();
  const texte = texteModifiable(contenu);

  const fondAltere: ModeleCarte = {
    ...contenu,
    fond: { ...contenu.fond, couleur: "#000000" },
  };
  assert.equal(verifierContenuCarte(modele, fondAltere).ok, false);

  // La photo fait partie du fond : elle ne peut pas être injectée par le JSON.
  const photoAlteree: ModeleCarte = {
    ...contenu,
    fond: { ...contenu.fond, photo: "https://exemple.test/photo.webp" },
  };
  assert.equal(verifierContenuCarte(modele, photoAlteree).ok, false);

  // `rotation` et `alignement` ne font pas partie des champs éditables.
  const rotation = remplacer(contenu, texte.id, {
    rotation: texte.rotation + 15,
  });
  assert.equal(verifierContenuCarte(modele, rotation).ok, false);

  const alignement = remplacer(contenu, texte.id, {
    alignement: texte.alignement === "centre" ? "gauche" : "centre",
  });
  assert.equal(verifierContenuCarte(modele, alignement).ok, false);
});

test("la modification du calque est acceptée", () => {
  const contenu = copie();
  const calqueAltere: ModeleCarte = {
    ...contenu,
    calque: { couleur: "#112233", opacite: 0.4 },
  };

  const resultat = verifierContenuCarte(modele, calqueAltere);
  assert.equal(resultat.ok, true);

  if (resultat.ok) {
    assert.deepEqual(resultat.contenu.calque, {
      couleur: "#112233",
      opacite: 0.4,
    });
  }
});

test("un calque hors bornes ou avec une couleur invalide est refusé", () => {
  const contenu = copie();

  const opaciteInvalide: ModeleCarte = {
    ...contenu,
    calque: { ...contenu.calque, opacite: 2 },
  };
  assert.equal(verifierContenuCarte(modele, opaciteInvalide).ok, false);

  const couleurInvalide: ModeleCarte = {
    ...contenu,
    calque: { ...contenu.calque, couleur: "rouge" },
  };
  assert.equal(verifierContenuCarte(modele, couleurInvalide).ok, false);
});

test("un champ supplémentaire ou un élément ajouté est refusé", () => {
  const contenu = copie();
  const texte = texteModifiable(contenu);

  const champEnTrop = {
    ...remplacer(contenu, texte.id, {}),
    elements: contenu.elements.map((element) =>
      element.id === texte.id ? { ...element, couleurFond: "#ffffff" } : element
    ),
  };
  assert.equal(verifierContenuCarte(modele, champEnTrop).ok, false);

  const elementAjoute: ModeleCarte = {
    ...contenu,
    elements: [
      ...contenu.elements,
      { ...texte, id: "texte-ajoute", modifiable: true },
    ],
  };
  assert.equal(verifierContenuCarte(modele, elementAjoute).ok, false);
});
