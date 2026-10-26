"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { EtatAuth } from "@/lib/auth/etat";
import { verifierLimite } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  connexionSchema,
  inscriptionSchema,
} from "@/lib/validation/auth";

const MESSAGE_INDISPONIBLE =
  "Service momentanément indisponible. Réessaie dans un instant.";
const MESSAGE_TROP_DE_TENTATIVES =
  "Trop de tentatives. Réessaie dans quelques minutes.";
const MESSAGE_IDENTIFIANTS_INCORRECTS = "E-mail ou mot de passe incorrect.";

/**
 * Clé de limitation : adresse IP fournie par la plateforme d'hébergement.
 * Elle ne sert qu'à compter les tentatives, jamais à autoriser une action.
 */
async function cleDeLimite(action: string): Promise<string> {
  const entetes = await headers();
  const transmise = entetes.get("x-forwarded-for");
  const ip = transmise
    ? transmise.split(",")[0]?.trim()
    : entetes.get("x-real-ip")?.trim();

  return `${action}:${ip || "inconnue"}`;
}

/** Ne réaffiche que du texte, jamais un fichier ou un objet inattendu. */
function emailSaisi(valeur: FormDataEntryValue | null): string {
  return typeof valeur === "string" ? valeur.slice(0, 254) : "";
}

/**
 * Inscription d'un organisateur.
 *
 * Si la confirmation d'e-mail est activée dans Supabase, aucune session n'est
 * créée : on invite l'utilisateur à cliquer sur le lien reçu. Sinon, la session
 * est ouverte et on redirige vers le tableau de bord.
 */
export async function inscription(
  _etatPrecedent: EtatAuth,
  formData: FormData
): Promise<EtatAuth> {
  const emailVisible = emailSaisi(formData.get("email"));

  const limite = verifierLimite(
    await cleDeLimite("inscription"),
    5,
    60 * 60 * 1000
  );
  if (!limite.autorise) {
    return { erreur: MESSAGE_TROP_DE_TENTATIVES, email: emailVisible };
  }

  const resultat = inscriptionSchema.safeParse({
    email: formData.get("email"),
    motDePasse: formData.get("motDePasse"),
    confirmation: formData.get("confirmation"),
  });

  if (!resultat.success) {
    return {
      erreur:
        resultat.error.issues[0]?.message ??
        "Vérifie les champs du formulaire.",
      email: emailVisible,
    };
  }

  let sessionOuverte = false;

  try {
    const supabase = await createSupabaseServerClient();

    // Le lien de confirmation doit revenir sur notre route d'échange de code.
    // La valeur est validée par Supabase contre la liste blanche du dashboard.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

    const { data, error } = await supabase.auth.signUp({
      email: resultat.data.email,
      password: resultat.data.motDePasse,
      options: siteUrl
        ? { emailRedirectTo: `${siteUrl}/auth/confirmation` }
        : undefined,
    });

    if (error) {
      // Limite d'envoi d'e-mails du service Supabase : le compte n'a pas été
      // créé. Message explicite sans révéler d'information sur les comptes.
      if (error.status === 429 || error.code === "over_email_send_rate_limit") {
        return {
          erreur:
            "Trop de demandes d'inscription. Réessaie dans quelques minutes.",
          email: emailVisible,
        };
      }

      // Message volontairement générique : on n'indique pas si l'adresse
      // existe déjà (limite l'énumération de comptes).
      return {
        erreur:
          "Inscription impossible avec ces informations. Si tu as déjà un compte, connecte-toi.",
        email: emailVisible,
      };
    }

    sessionOuverte = Boolean(data.session);
  } catch {
    return { erreur: MESSAGE_INDISPONIBLE, email: emailVisible };
  }

  if (!sessionOuverte) {
    return {
      succes:
        "Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.",
    };
  }

  // Hors du try/catch : redirect() lève une exception interne à Next.js.
  redirect("/tableau-de-bord");
}

/**
 * Connexion d'un organisateur.
 *
 * Toutes les erreurs d'identifiants renvoient le même message, quelle que soit
 * la cause (compte inexistant, mot de passe faux, e-mail non confirmé).
 */
export async function connexion(
  _etatPrecedent: EtatAuth,
  formData: FormData
): Promise<EtatAuth> {
  const emailVisible = emailSaisi(formData.get("email"));

  const limite = verifierLimite(
    await cleDeLimite("connexion"),
    10,
    5 * 60 * 1000
  );
  if (!limite.autorise) {
    return { erreur: MESSAGE_TROP_DE_TENTATIVES, email: emailVisible };
  }

  const resultat = connexionSchema.safeParse({
    email: formData.get("email"),
    motDePasse: formData.get("motDePasse"),
  });

  if (!resultat.success) {
    return {
      erreur:
        resultat.error.issues[0]?.message ??
        "Renseigne ton e-mail et ton mot de passe.",
      email: emailVisible,
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: resultat.data.email,
      password: resultat.data.motDePasse,
    });

    if (error) {
      if (error.status === 429) {
        return { erreur: MESSAGE_TROP_DE_TENTATIVES, email: emailVisible };
      }

      return {
        erreur: MESSAGE_IDENTIFIANTS_INCORRECTS,
        email: emailVisible,
      };
    }
  } catch {
    return { erreur: MESSAGE_INDISPONIBLE, email: emailVisible };
  }

  redirect("/tableau-de-bord");
}

/** Déconnexion : supprime la session côté Supabase et efface les cookies. */
export async function deconnexion(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Même si l'appel échoue, on renvoie vers l'accueil. Le proxy continuera
    // de valider la session à chaque requête.
  }

  redirect("/");
}
