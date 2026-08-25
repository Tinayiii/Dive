alter table public.dates
  add column if not exists cover_prompt text,
  add column if not exists cover_image_url text;
