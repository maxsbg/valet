-- Valet – Bildspeicher für Teile (Supabase Storage, Bucket "items")
-- Ablage: <wardrobe_id>/<item_id>/<seite>-<zeitstempel>.webp (+ "-thumb.webp" als Vorschaubild für die Kacheln)
--
-- Der Bucket ist "public": Bilder sind über ihre Adresse ohne Anmeldung abrufbar. Die Adressen enthalten
-- zwei zufällige IDs und sind nicht zu erraten; dafür bleiben die Adressen stabil und der Browser kann die
-- Bilder zwischenspeichern (bei privaten Buckets bräuchte jede Sitzung neue signierte Adressen → alles neu laden).
-- Hochladen, Ändern und Löschen dürfen nur Mitglieder des Schranks mit Schreibrecht.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('items', 'items', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Erster Ordner des Pfads = Schrank-ID. Ungültige Pfade (keine UUID) ergeben null → kein Zugriff.
create or replace function public.storage_wardrobe(path text) returns uuid language sql immutable as $$
  select case when (storage.foldername(path))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then ((storage.foldername(path))[1])::uuid end;
$$;

drop policy if exists items_files_read   on storage.objects;
drop policy if exists items_files_insert on storage.objects;
drop policy if exists items_files_update on storage.objects;
drop policy if exists items_files_delete on storage.objects;

-- Auflisten nur für Mitglieder (das reine Abrufen eines Bildes über die öffentliche Adresse braucht keine Regel)
create policy items_files_read on storage.objects for select to authenticated
  using (bucket_id = 'items' and public.is_member(public.storage_wardrobe(name)));
create policy items_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'items' and public.is_member(public.storage_wardrobe(name), 'edit'));
create policy items_files_update on storage.objects for update to authenticated
  using (bucket_id = 'items' and public.is_member(public.storage_wardrobe(name), 'edit'))
  with check (bucket_id = 'items' and public.is_member(public.storage_wardrobe(name), 'edit'));
create policy items_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'items' and public.is_member(public.storage_wardrobe(name), 'edit'));

