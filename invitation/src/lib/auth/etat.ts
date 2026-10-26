/**
 * État renvoyé par les Server Actions d'authentification et consommé par
 * `useActionState` côté navigateur.
 *
 * Aucun détail technique (code d'erreur Supabase, message SQL…) n'y est
 * exposé : uniquement des messages génériques destinés à l'utilisateur.
 */
export type EtatAuth = {
  erreur?: string;
  succes?: string;
  /** Ré-affiche l'e-mail saisi après une erreur (jamais le mot de passe). */
  email?: string;
};
