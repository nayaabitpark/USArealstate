-- Multiple photos per property (safe to re-run). Run once in Supabase SQL Editor.
-- image_url stays as the cover photo; image_urls holds ALL photos (cover first).
alter table public.properties add column if not exists image_urls text[] not null default '{}';

-- carry over existing single photos
update public.properties
set image_urls = array[image_url]
where image_url is not null and coalesce(array_length(image_urls,1),0) = 0;

notify pgrst, 'reload schema';
