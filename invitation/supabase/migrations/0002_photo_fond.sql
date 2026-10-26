-- =============================================================================
-- 0002_photo_fond.sql — Photo de fond : colonne + bucket privé + politiques
--
-- À exécuter dans le SQL Editor du dashboard Supabase, ou via
-- `supabase db push` si la CLI est installée.
--
-- Principe de sécurité :
--   * le bucket `photos-fond` est PRIVÉ : aucune URL publique ne fonctionne ;
--   * un utilisateur authentifié ne lit, n'écrit et ne supprime que dans le
--     dossier `[son_user_id]/…` ;
--   * les fichiers sont toujours des WebP produits par le serveur, nommés par
--     un UUID, avec une taille maximale de 5 Mo.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Colonne : chemin Storage, jamais une URL publique.
-- -----------------------------------------------------------------------------

alter table public.cartes
  add column if not exists photo_fond_chemin text;

-- L'ancienne colonne n'a jamais été alimentée : le chemin Storage la remplace.
alter table public.cartes
  drop column if exists photo_fond_url;

-- Le chemin doit avoir exactement la forme
-- `[user_id]/[carte_id]/[uuid].webp`. Cette contrainte est une défense
-- supplémentaire contre une valeur corrompue ou injectée.
alter table public.cartes
  drop constraint if exists cartes_photo_fond_chemin_format;

alter table public.cartes
  add constraint cartes_photo_fond_chemin_format check (
    photo_fond_chemin is null
    or photo_fond_chemin ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
  );

-- -----------------------------------------------------------------------------
-- Bucket privé
--
-- `public = false` : même avec le chemin exact, une requête anonyme est
-- refusée. La lecture passe uniquement par une URL signée générée côté serveur.
-- `allowed_mime_types` limite aussi le type réellement stocké.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos-fond',
  'photos-fond',
  false,
  5242880, -- 5 Mo
  array['image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Politiques Storage : chaque utilisateur reste dans son dossier.
--
-- `storage.foldername(name)` renvoie les dossiers du chemin. Le premier est
-- toujours l'identifiant de l'utilisateur : `[user_id]/[carte_id]/[uuid].webp`.
-- Aucune politique n'est créée pour `anon`.
-- -----------------------------------------------------------------------------

drop policy if exists photos_fond_select_proprietaire on storage.objects;
create policy photos_fond_select_proprietaire on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos-fond'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists photos_fond_insert_proprietaire on storage.objects;
create policy photos_fond_insert_proprietaire on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos-fond'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists photos_fond_update_proprietaire on storage.objects;
create policy photos_fond_update_proprietaire on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos-fond'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'photos-fond'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists photos_fond_delete_proprietaire on storage.objects;
create policy photos_fond_delete_proprietaire on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos-fond'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
