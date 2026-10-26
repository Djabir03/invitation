-- =============================================================================
-- 0001_init.sql — Schéma initial : cartes, invites, reponses + RLS
--
-- À exécuter dans le SQL Editor du dashboard Supabase, ou via
-- `supabase db push` si la CLI est installée.
--
-- Principes de sécurité :
--   * RLS activé sur les 3 tables.
--   * `anon` n'a aucun droit : un invité ne lit jamais les tables directement.
--   * `authenticated` (organisateur) n'accède qu'à ses propres lignes.
--   * `service_role` (serveur uniquement) assure les écritures RSVP.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table if not exists public.cartes (
  id              uuid primary key default gen_random_uuid(),
  organisateur    uuid not null references auth.users (id) on delete cascade,
  modele          text not null,
  contenu         jsonb not null default '{}'::jsonb,
  photo_fond_url  text,
  created_at      timestamptz not null default now()
);

create table if not exists public.invites (
  id            uuid primary key default gen_random_uuid(),
  carte_id      uuid not null references public.cartes (id) on delete cascade,
  nom           text not null,
  code          text not null unique,          -- code aléatoire >= 16 caractères
  places        integer not null default 1 check (places >= 1),
  date_limite   timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.reponses (
  id                uuid primary key default gen_random_uuid(),
  invite_id         uuid not null unique references public.invites (id) on delete cascade,
  statut            text not null default 'en_attente'
                    check (statut in ('en_attente', 'vient', 'ne_vient_pas')),
  nombre_personnes  integer check (nombre_personnes is null or nombre_personnes >= 1),
  date_reponse      timestamptz,
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Index (les colonnes `code` et `invite_id` sont déjà indexées par leurs
-- contraintes unique).
-- -----------------------------------------------------------------------------

create index if not exists cartes_organisateur_idx on public.cartes (organisateur);
create index if not exists invites_carte_id_idx on public.invites (carte_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.cartes   enable row level security;
alter table public.invites  enable row level security;
alter table public.reponses enable row level security;

-- -----------------------------------------------------------------------------
-- Droits : retrait total, puis redonnés strictement.
-- -----------------------------------------------------------------------------

revoke all on table public.cartes   from anon, authenticated;
revoke all on table public.invites  from anon, authenticated;
revoke all on table public.reponses from anon, authenticated;

grant select, insert, update, delete on table public.cartes   to authenticated;
grant select, insert, update, delete on table public.invites  to authenticated;
grant select, insert, update         on table public.reponses to authenticated;

-- Le serveur (service_role) doit pouvoir écrire les réponses RSVP.
-- Cette clé n'est jamais utilisée dans le navigateur.
grant select, insert, update, delete on table public.cartes   to service_role;
grant select, insert, update, delete on table public.invites  to service_role;
grant select, insert, update, delete on table public.reponses to service_role;

-- -----------------------------------------------------------------------------
-- Policies : cartes (propriétaire = organisateur)
-- -----------------------------------------------------------------------------

drop policy if exists cartes_select_proprietaire on public.cartes;
create policy cartes_select_proprietaire on public.cartes
  for select to authenticated
  using (organisateur = (select auth.uid()));

drop policy if exists cartes_insert_proprietaire on public.cartes;
create policy cartes_insert_proprietaire on public.cartes
  for insert to authenticated
  with check (organisateur = (select auth.uid()));

drop policy if exists cartes_update_proprietaire on public.cartes;
create policy cartes_update_proprietaire on public.cartes
  for update to authenticated
  using (organisateur = (select auth.uid()))
  with check (organisateur = (select auth.uid()));

drop policy if exists cartes_delete_proprietaire on public.cartes;
create policy cartes_delete_proprietaire on public.cartes
  for delete to authenticated
  using (organisateur = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Policies : invites (propriétaire de la carte liée)
-- -----------------------------------------------------------------------------

drop policy if exists invites_select_proprietaire on public.invites;
create policy invites_select_proprietaire on public.invites
  for select to authenticated
  using (exists (
    select 1 from public.cartes c
    where c.id = carte_id
      and c.organisateur = (select auth.uid())
  ));

drop policy if exists invites_insert_proprietaire on public.invites;
create policy invites_insert_proprietaire on public.invites
  for insert to authenticated
  with check (exists (
    select 1 from public.cartes c
    where c.id = carte_id
      and c.organisateur = (select auth.uid())
  ));

-- `with check` empêche de déplacer un invité vers la carte d'un autre.
drop policy if exists invites_update_proprietaire on public.invites;
create policy invites_update_proprietaire on public.invites
  for update to authenticated
  using (exists (
    select 1 from public.cartes c
    where c.id = carte_id
      and c.organisateur = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.cartes c
    where c.id = carte_id
      and c.organisateur = (select auth.uid())
  ));

drop policy if exists invites_delete_proprietaire on public.invites;
create policy invites_delete_proprietaire on public.invites
  for delete to authenticated
  using (exists (
    select 1 from public.cartes c
    where c.id = carte_id
      and c.organisateur = (select auth.uid())
  ));

-- -----------------------------------------------------------------------------
-- Policies : reponses (propriétaire de la carte de l'invité)
--
-- L'organisateur peut lire, créer et modifier les réponses de ses invités
-- (ex. marquage manuel). Aucune policy `anon` : la réponse d'un invité passe
-- par une route serveur qui vérifie le code et utilise service_role.
-- -----------------------------------------------------------------------------

drop policy if exists reponses_select_proprietaire on public.reponses;
create policy reponses_select_proprietaire on public.reponses
  for select to authenticated
  using (exists (
    select 1
    from public.invites i
    join public.cartes c on c.id = i.carte_id
    where i.id = reponses.invite_id
      and c.organisateur = (select auth.uid())
  ));

drop policy if exists reponses_insert_proprietaire on public.reponses;
create policy reponses_insert_proprietaire on public.reponses
  for insert to authenticated
  with check (exists (
    select 1
    from public.invites i
    join public.cartes c on c.id = i.carte_id
    where i.id = invite_id
      and c.organisateur = (select auth.uid())
  ));

drop policy if exists reponses_update_proprietaire on public.reponses;
create policy reponses_update_proprietaire on public.reponses
  for update to authenticated
  using (exists (
    select 1
    from public.invites i
    join public.cartes c on c.id = i.carte_id
    where i.id = reponses.invite_id
      and c.organisateur = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.invites i
    join public.cartes c on c.id = i.carte_id
    where i.id = invite_id
      and c.organisateur = (select auth.uid())
  ));

commit;
