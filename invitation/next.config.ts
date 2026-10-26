import type { NextConfig } from "next";

/**
 * En-têtes de sécurité de base appliqués à toutes les routes.
 * La défense en profondeur reste assurée côté application (RLS, vérification
 * d'authentification et de propriété dans chaque action serveur).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // Ne jamais exposer les source maps du navigateur en production.
  productionBrowserSourceMaps: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Page publique d'un invité : aucune mise en cache partagée et aucune
        // fuite du code via les moteurs de recherche ou le Referer. Cette
        // règle vient après la règle générale : Next.js fait gagner la
        // dernière valeur pour une même clé (ici Referrer-Policy).
        source: "/i/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet",
          },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
