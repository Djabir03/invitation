import {
  Bebas_Neue,
  Cinzel,
  Cormorant_Garamond,
  Great_Vibes,
  Lora,
  Montserrat,
  Playfair_Display,
  Poppins,
} from "next/font/google";

import type { Police } from "@/lib/validation/modele";

/**
 * Chargement des polices Google via next/font.
 *
 * Cette table doit couvrir exactement POLICES_AUTORISEES (vérifié par le type
 * `Record<Police, …>`) : le schéma Zod interdit toute autre valeur.
 * Les polices sont auto-hébergées par Next.js au build, sans requête vers
 * Google au runtime.
 */

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const cinzel = Cinzel({
  subsets: ["latin"],
  display: "swap",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
});

export const POLICES = {
  "Playfair Display": playfairDisplay,
  "Cormorant Garamond": cormorantGaramond,
  Lora: lora,
  Montserrat: montserrat,
  Poppins: poppins,
  Cinzel: cinzel,
  "Great Vibes": greatVibes,
  "Bebas Neue": bebasNeue,
} satisfies Record<Police, { className: string }>;
