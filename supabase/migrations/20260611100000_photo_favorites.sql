-- Per-user photo favorites: each user curates their own Favorites
-- collection, surfaced as a pinned "folder" at the top of Photos.

create table photo_favorites (
  photo_id uuid not null references photos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

create index photo_favorites_user_id_idx on photo_favorites (user_id);

alter table photo_favorites enable row level security;

-- Favorites are personal: every authenticated user manages their own.
create policy "favorites readable (own)" on photo_favorites
  for select to authenticated using (user_id = auth.uid());
create policy "favorites insertable (own)" on photo_favorites
  for insert to authenticated with check (user_id = auth.uid());
create policy "favorites deletable (own)" on photo_favorites
  for delete to authenticated using (user_id = auth.uid());
