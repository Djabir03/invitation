-- =============================================================================
-- 0003_invites.sql — Contraintes de validation des invités
--
-- À exécuter dans le SQL Editor du dashboard Supabase, ou via
-- `supabase db push` si la CLI est installée.
--
-- L'application valide déjà ces règles (Zod + actions serveur). Ces
-- contraintes les font respecter au niveau de la base, y compris pour une
-- écriture qui contournerait l'interface.
--
-- `not valid` valide toutes les nouvelles lignes sans bloquer la migration si
-- d'anciennes données ne respectent pas encore les bornes. Une fois les
-- données vérifiées, on peut lancer :
--   alter table public.invites validate constraint invites_nom_longueur;
-- =============================================================================

begin;

alter table public.invites
  drop constraint if exists invites_nom_longueur,
  drop constraint if exists invites_places_limite,
  drop constraint if exists invites_code_format;

-- Nom : 1 à 120 caractères, sans espaces en début ou en fin.
alter table public.invites
  add constraint invites_nom_longueur
  check (char_length(btrim(nom)) between 1 and 120) not valid;

-- Places : 1 à 20 (la contrainte initiale ne garantissait que >= 1).
alter table public.invites
  add constraint invites_places_limite
  check (places between 1 and 20) not valid;

-- Code : 24 octets en base64url, soit exactement 32 caractères.
alter table public.invites
  add constraint invites_code_format
  check (code ~ '^[A-Za-z0-9_-]{32}$') not valid;

commit;
