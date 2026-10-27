# Invitation — cartes d'invitation animées

Application web permettant de créer une carte d'invitation à partir d'un
modèle, de la personnaliser, puis d'envoyer un lien unique à chaque invité.
Chaque invité découvre sa carte dans une enveloppe nominative qui s'ouvre au
clic.

Trois temps : **Créer**, **Envoyer**, **Révéler**.

## Fonctionnalités

- **10 modèles** prêts à personnaliser (mariage, anniversaire, baptême,
  cérémonie, soirée, entreprise, diplôme, fêtes).
- **Éditeur** : textes modifiables (titre, date, lieu, message), police,
  taille, couleur, position ; photo de fond recadrée, compressée et
  ré-encodée en WebP côté serveur (métadonnées supprimées).
- **Invités** : saisie d'une liste de noms, génération d'un code secret de
  32 caractères par invité, lien personnel et message WhatsApp prêt à envoyer.
- **Page publique** `/i/[code]` : enveloppe « Pour [nom] », ouverture animée
  avec GSAP (transform et opacity uniquement), carte en lecture seule.
- **Sécurité** : lecture serveur uniquement, limitation de débit par IP,
  404 identique pour un code invalide, inconnu ou trop fréquent, aucun cache
  partagé et aucune indexation.

## Pile technique

- [Next.js 16](https://nextjs.org) (App Router, `cacheComponents`, Proxy)
- React 19, TypeScript strict, Tailwind CSS 4
- Supabase : Auth, Postgres (RLS), Storage privé
- Konva / react-konva pour le canevas d'édition
- GSAP pour l'ouverture de l'enveloppe
- Zod pour la validation, Sharp pour le traitement d'images

## Structure

```
invitation/            application Next.js
  src/app/             routes (auth, tableau de bord, éditeur, invités, /i)
  src/components/      rendu de carte partagé, écran 404
  src/lib/             accès Supabase, validation, rate limit, images
  src/templates/       les 10 modèles (JSON)
  supabase/migrations/ schéma, Storage et politiques RLS
  tests/               tests unitaires (node --test)
```

## Démarrage

Prérequis : Node.js 20 ou plus récent, un projet Supabase.

```bash
cd invitation
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev
```

Variables attendues dans `.env.local` :

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé anonyme, utilisée côté navigateur |
| `SUPABASE_SERVICE_ROLE_KEY` | clé secrète, réservée au serveur (`server-only`) |
| `NEXT_PUBLIC_SITE_URL` | base des liens d'invitation et de confirmation |

La clé `service_role` ne doit jamais être exposée au navigateur ni commitée.

## Base de données

Appliquer les migrations dans l'ordre, via le SQL Editor du dashboard Supabase
ou la CLI :

```
supabase/migrations/0001_init.sql        tables, RLS, triggers
supabase/migrations/0002_photo_fond.sql  bucket privé `photos-fond`
supabase/migrations/0003_invites.sql     invités et réponses
```

## Commandes

```bash
npm run dev     # serveur de développement
npm run build   # build de production
npm start       # serveur de production
npm run lint    # ESLint
npm test        # tests unitaires
```

## Notes de sécurité

- Les pages protégées et chaque action serveur revalident la session ; la RLS
  applique la propriété des cartes.
- La page publique ne dépend d'aucune session : le code secret est la seule
  clé d'accès. Elle est lue avec le client `service_role` côté serveur et ne
  transmet au navigateur qu'un objet réduit.
- La photo de fond reste dans un bucket privé. La page publique la sert via
  `/i/[code]/photo` : l'URL signée d'une heure est créée et consommée côté
  serveur, jamais exposée.
- `/i/:path*` est servi avec `Cache-Control: no-store`, `X-Robots-Tag:
  noindex` et `Referrer-Policy: no-referrer`.

## Licence

Projet privé.
