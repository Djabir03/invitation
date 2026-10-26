import type { CookieOptions } from "@supabase/ssr";

/**
 * Options communes aux cookies de session Supabase.
 *
 * `httpOnly` empêche le JavaScript du navigateur de lire les jetons : toute
 * l'authentification passe par le serveur (Server Actions, proxy, route
 * handlers), donc le client n'a pas besoin d'y accéder. Cela réduit l'impact
 * d'une éventuelle faille XSS.
 *
 * `secure` n'est activé qu'en production pour ne pas casser le HTTP local.
 */
export const OPTIONS_COOKIES_SUPABASE: CookieOptions = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
