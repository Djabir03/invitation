# Base de données et Storage

Les migrations SQL doivent être appliquées **dans l'ordre** depuis le SQL Editor
du dashboard Supabase (ou avec `supabase db push` si la CLI est installée).

1. `migrations/0001_init.sql` — tables `cartes`, `invites`, `reponses` et RLS.
2. `migrations/0002_photo_fond.sql` — colonne `photo_fond_chemin`, bucket privé
   `photos-fond` et politiques Storage.

La migration `0002` est indispensable avant d'utiliser le bouton « Photo de
fond » : sans elle, l'envoi échoue (colonne ou bucket absent). L'éditeur reste
lisible, mais aucune photo ne peut être enregistrée.

## Vérifications après application

```sql
-- Le bucket doit être privé, limité à 5 Mo et au WebP.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'photos-fond';

-- Quatre politiques, toutes limitées au dossier de l'utilisateur.
select policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'photos_fond_%'
order by policyname;
```

La colonne doit accepter uniquement la forme
`[user_id]/[carte_id]/[uuid].webp` :

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cartes'
  and column_name in ('photo_fond_chemin', 'photo_fond_url');
```

`photo_fond_url` ne doit plus apparaître : elle a été remplacée par le chemin
Storage.
