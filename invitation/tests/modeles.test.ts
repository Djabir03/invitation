import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  modeleCarteSchema,
  type ElementTexte,
  type ModeleCarte,
} from "../src/lib/validation/modele.ts";

/**
 * Vérifie les dix modèles livrés : chaque fichier doit respecter le schéma,
 * porter un identifiant unique et exposer les quatre textes modifiables.
 *
 * Les fichiers sont lus depuis le disque (et non importés) pour que le test
 * reste indépendant de la résolution d'alias de Next.js.
 */

const DOSSIER = fileURLToPath(new URL("../src/templates/", import.meta.url));

const FICHIERS_ATTENDUS = [
  "anniversaire-adulte",
  "anniversaire-enfant",
  "bapteme-naissance",
  "ceremonie-traditionnelle",
  "evenement-entreprise",
  "fetes-fin-annee",
  "mariage-classique",
  "mariage-floral",
  "remise-diplome",
  "soiree-fete",
] as const;

const TEXTES_MODIFIABLES = ["titre", "date", "lieu", "message"] as const;

function lireModeles(): Array<{ fichier: string; modele: ModeleCarte }> {
  const fichiers = readdirSync(DOSSIER)
    .filter((nom) => nom.endsWith(".json"))
    .sort();

  assert.deepEqual(
    fichiers,
    FICHIERS_ATTENDUS.map((nom) => `${nom}.json`),
    "Le dossier src/templates doit contenir exactement les dix modèles attendus."
  );

  return fichiers.map((fichier) => {
    const brut: unknown = JSON.parse(readFileSync(`${DOSSIER}${fichier}`, "utf8"));
    const resultat = modeleCarteSchema.safeParse(brut);

    assert.equal(
      resultat.success,
      true,
      `${fichier} ne respecte pas le schéma : ${
        resultat.success
          ? ""
          : resultat.error.issues
              .map((issue) => `${issue.path.join(".") || "(racine)"} ${issue.message}`)
              .join(" ; ")
      }`
    );

    return { fichier, modele: resultat.data as ModeleCarte };
  });
}

const modeles = lireModeles();

test("les dix modèles sont présents et valides", () => {
  assert.equal(modeles.length, 10);
});

test("chaque modèle porte l'identifiant de son fichier", () => {
  for (const { fichier, modele } of modeles) {
    assert.equal(modele.id, fichier.replace(/\.json$/, ""), fichier);
  }

  const identifiants = new Set(modeles.map(({ modele }) => modele.id));
  assert.equal(identifiants.size, modeles.length, "Les identifiants doivent être uniques.");
});

test("chaque modèle expose titre, date, lieu et message modifiables", () => {
  for (const { fichier, modele } of modeles) {
    const textes = modele.elements.filter(
      (element): element is ElementTexte => element.type === "texte"
    );

    for (const identifiant of TEXTES_MODIFIABLES) {
      const texte = textes.find((element) => element.id === identifiant);

      assert.ok(texte, `${fichier} : texte « ${identifiant} » manquant.`);
      assert.equal(texte.modifiable, true, `${fichier} : « ${identifiant} » doit être modifiable.`);
      assert.ok(texte.contenu.trim().length > 0, `${fichier} : « ${identifiant} » est vide.`);
    }
  }
});

test("un modèle mal formé est rejeté", () => {
  const { modele } = modeles[0];
  const malForme = {
    ...modele,
    largeur: 1200,
    elements: modele.elements.map((element) =>
      element.type === "texte" ? { ...element, police: "Comic Sans MS" } : element
    ),
  };

  const resultat = modeleCarteSchema.safeParse(malForme);
  assert.equal(resultat.success, false);

  if (!resultat.success) {
    const chemins = resultat.error.issues.map((issue) => issue.path.join("."));
    assert.ok(chemins.includes("largeur"), "La largeur invalide doit être signalée.");
    assert.ok(
      chemins.some((chemin) => chemin.endsWith("police")),
      "La police hors liste blanche doit être signalée."
    );
  }
});
