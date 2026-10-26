import anniversaireAdulte from "@/templates/anniversaire-adulte.json";
import anniversaireEnfant from "@/templates/anniversaire-enfant.json";
import baptemeNaissance from "@/templates/bapteme-naissance.json";
import ceremonieTraditionnelle from "@/templates/ceremonie-traditionnelle.json";
import evenementEntreprise from "@/templates/evenement-entreprise.json";
import fetesFinAnnee from "@/templates/fetes-fin-annee.json";
import mariageClassique from "@/templates/mariage-classique.json";
import mariageFloral from "@/templates/mariage-floral.json";
import remiseDiplome from "@/templates/remise-diplome.json";
import soireeFete from "@/templates/soiree-fete.json";

import { modeleCarteSchema, type ModeleCarte } from "@/lib/validation/modele";

/**
 * Index des modèles livrés avec l'application.
 *
 * Chaque fichier est validé au chargement du module. En cas d'erreur, le
 * message nomme le fichier fautif : le build échoue donc immédiatement au lieu
 * d'afficher une carte cassée.
 *
 * L'ordre du tableau est l'ordre d'affichage sur la page /modeles.
 */
const FICHIERS = {
  "mariage-classique": mariageClassique,
  "mariage-floral": mariageFloral,
  "anniversaire-enfant": anniversaireEnfant,
  "anniversaire-adulte": anniversaireAdulte,
  "bapteme-naissance": baptemeNaissance,
  "ceremonie-traditionnelle": ceremonieTraditionnelle,
  "soiree-fete": soireeFete,
  "evenement-entreprise": evenementEntreprise,
  "remise-diplome": remiseDiplome,
  "fetes-fin-annee": fetesFinAnnee,
} as const;

function chargerModele(nomFichier: string, brut: unknown): ModeleCarte {
  const resultat = modeleCarteSchema.safeParse(brut);

  if (!resultat.success) {
    const details = resultat.error.issues
      .map((issue) => `${issue.path.join(".") || "(racine)"} : ${issue.message}`)
      .join(" ; ");

    throw new Error(`Modèle invalide « ${nomFichier}.json » — ${details}`);
  }

  return resultat.data;
}

export const MODELES: ModeleCarte[] = Object.entries(FICHIERS).map(
  ([nomFichier, brut]) => chargerModele(nomFichier, brut)
);
