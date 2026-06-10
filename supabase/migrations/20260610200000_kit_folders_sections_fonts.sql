-- Kit organization: nestable kit folders, named sections within kits,
-- and externally-sourced fonts (Google Fonts / Adobe Fonts).

-- ---------------------------------------------------------------------------
-- Kit folders: a tree for grouping kits (e.g. "Sermon Series" > one kit per
-- series). Mirrors the photo folder tree but is a separate hierarchy — the
-- two trees stay parallel, never conflated.
-- ---------------------------------------------------------------------------

create table kit_folders (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  parent_id uuid references kit_folders (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table kits
  add column kit_folder_id uuid references kit_folders (id) on delete set null;

create index kit_folders_parent_id_idx on kit_folders (parent_id);
create index kits_kit_folder_id_idx on kits (kit_folder_id);

-- ---------------------------------------------------------------------------
-- Kit sections: named groups of file assets within a kit
-- ("Social Media", "Source Files", ...). Unsectioned assets are allowed.
-- ---------------------------------------------------------------------------

create table kit_sections (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references kits (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table kit_assets
  add column section_id uuid references kit_sections (id) on delete set null;

create index kit_sections_kit_id_idx on kit_sections (kit_id);
create index kit_assets_section_id_idx on kit_assets (section_id);

-- ---------------------------------------------------------------------------
-- Font sources: uploaded files (existing), Google Fonts (family name), or
-- Adobe Fonts (web project id). external_ref holds the family/project id.
-- ---------------------------------------------------------------------------

alter table fonts
  add column source text not null default 'upload'
    check (source in ('upload', 'google', 'adobe'));
alter table fonts
  add column external_ref text;

-- ---------------------------------------------------------------------------
-- RLS (same pattern as existing tables)
-- ---------------------------------------------------------------------------

alter table kit_folders enable row level security;
alter table kit_sections enable row level security;

create policy "kit_folders readable" on kit_folders for select to authenticated using (true);
create policy "kit_folders writable" on kit_folders for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "kit_folders updatable" on kit_folders for update to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "kit_folders deletable" on kit_folders for delete to authenticated
  using (current_app_role() = 'admin');

create policy "kit_sections readable" on kit_sections for select to authenticated using (true);
create policy "kit_sections writable" on kit_sections for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "kit_sections updatable" on kit_sections for update to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "kit_sections deletable" on kit_sections for delete to authenticated
  using (current_app_role() in ('admin', 'editor'));
