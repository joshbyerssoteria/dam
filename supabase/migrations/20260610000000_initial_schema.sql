-- Soteria DAM — initial schema
-- Two parallel trees: kits (brand assets, replaces Lingo) and folders (photos, replaces Zenfolio).
-- Do not conflate them.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Roles and profiles (extends Supabase Auth)
-- ---------------------------------------------------------------------------

create type app_role as enum ('admin', 'editor', 'viewer');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  role app_role not null default 'viewer',
  created_at timestamptz not null default now()
);

-- First user to sign up becomes admin; everyone after defaults to viewer.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when not exists (select 1 from public.profiles) then 'admin'::app_role else 'viewer'::app_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Role helper for RLS policies. SECURITY DEFINER so it can read profiles
-- regardless of the caller's own row visibility.
create or replace function current_app_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Workspace (one for v1: Soteria)
-- ---------------------------------------------------------------------------

create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Shared file storage (S3-backed blobs)
-- ---------------------------------------------------------------------------

create table files (
  id uuid primary key default gen_random_uuid(),
  s3_key text not null unique,
  s3_bucket text not null,
  mime_type text not null,
  original_filename text not null,
  file_size bigint not null,
  width integer,
  height integer,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Brand asset side (replaces Lingo)
-- ---------------------------------------------------------------------------

create table kits (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  share_token text unique,
  share_password_hash text,
  share_expires_at timestamptz,
  cover_image_id uuid references files (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, slug)
);

create table palettes (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references kits (id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table colors (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references palettes (id) on delete cascade,
  hex text not null,
  name text,
  role text,
  rgb text,
  cmyk text,
  pantone text,
  sort_order integer not null default 0
);

create table fonts (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references kits (id) on delete cascade,
  family text not null,
  foundry text,
  license_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table font_files (
  id uuid primary key default gen_random_uuid(),
  font_id uuid not null references fonts (id) on delete cascade,
  weight integer,
  style text,
  file_id uuid not null references files (id) on delete cascade
);

-- Polymorphic membership: a kit holds files, palettes, and fonts in one
-- ordered list. asset_id references files/palettes/fonts by asset_type.
create table kit_assets (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references kits (id) on delete cascade,
  asset_type text not null check (asset_type in ('file', 'palette', 'font')),
  asset_id uuid not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (kit_id, asset_type, asset_id)
);

-- ---------------------------------------------------------------------------
-- Photo side (replaces Zenfolio)
-- ---------------------------------------------------------------------------

create table folders (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  parent_id uuid references folders (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  share_token text unique,
  share_password_hash text,
  share_expires_at timestamptz,
  cover_photo_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references folders (id) on delete cascade,
  file_id uuid not null references files (id) on delete cascade,
  ai_tags text[] not null default '{}',
  ai_caption text,
  ai_scene text,
  event_type text,
  embedding vector(1536),
  taken_at timestamptz,
  photographer_name text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table folders
  add constraint folders_cover_photo_id_fkey
  foreign key (cover_photo_id) references photos (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Sharing and uploads
-- ---------------------------------------------------------------------------

create table share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  target_type text not null check (target_type in ('kit', 'folder')),
  target_id uuid not null,
  expires_at timestamptz,
  password_hash text,
  download_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table upload_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  target_folder_id uuid not null references folders (id) on delete cascade,
  expires_at timestamptz,
  max_files integer,
  used_count integer not null default 0,
  photographer_name text,
  photographer_email text,
  instructions text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create table download_log (
  id uuid primary key default gen_random_uuid(),
  share_token text not null,
  file_id uuid references files (id) on delete set null,
  ip_hash text,
  downloaded_at timestamptz not null default now()
);

create table upload_log (
  id uuid primary key default gen_random_uuid(),
  upload_token text not null,
  file_id uuid references files (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index folders_parent_id_idx on folders (parent_id);
create index folders_space_id_idx on folders (space_id);
create index kits_space_id_idx on kits (space_id);
create index kit_assets_kit_id_idx on kit_assets (kit_id);
create index palettes_kit_id_idx on palettes (kit_id);
create index colors_palette_id_idx on colors (palette_id);
create index fonts_kit_id_idx on fonts (kit_id);
create index font_files_font_id_idx on font_files (font_id);
create index photos_folder_id_idx on photos (folder_id);
create index photos_ai_tags_idx on photos using gin (ai_tags);
create index photos_embedding_idx on photos
  using hnsw (embedding vector_cosine_ops);
create index share_links_token_idx on share_links (token);
create index upload_tokens_token_idx on upload_tokens (token);

-- ---------------------------------------------------------------------------
-- Hybrid search: vector similarity + keyword overlap, weighted.
-- Defaults to 70/30 semantic/keyword per spec. Works keyword-only when the
-- caller has no embedding (e.g. embeddings service not configured).
-- ---------------------------------------------------------------------------

create or replace function search_photos(
  query_embedding vector(1536) default null,
  query_tags text[] default '{}',
  semantic_weight double precision default 0.7,
  match_limit integer default 60
)
returns table (
  photo_id uuid,
  semantic_score double precision,
  keyword_score double precision,
  score double precision
)
language sql
stable
as $$
  with scored as (
    select
      p.id,
      case
        when query_embedding is not null and p.embedding is not null
          then 1 - (p.embedding <=> query_embedding)
        else 0
      end as semantic_score,
      case
        when cardinality(query_tags) > 0 and p.ai_tags && query_tags
          then (
            select count(*)::double precision
            from unnest(query_tags) qt
            where exists (
              select 1 from unnest(p.ai_tags) pt
              where lower(pt) = lower(qt)
            )
          ) / cardinality(query_tags)
        else 0
      end as keyword_score
    from photos p
  )
  select
    s.id,
    s.semantic_score,
    s.keyword_score,
    s.semantic_score * semantic_weight + s.keyword_score * (1 - semantic_weight) as score
  from scored s
  where s.semantic_score > 0 or s.keyword_score > 0
  order by score desc
  limit match_limit;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Authenticated users: viewers read everything; editors create and organize;
-- admins do anything. Editors may delete only their own photo uploads.
-- Public share/upload flows never hit these policies — they are served by the
-- service role, which validates tokens in application code.
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table spaces enable row level security;
alter table files enable row level security;
alter table kits enable row level security;
alter table kit_assets enable row level security;
alter table palettes enable row level security;
alter table colors enable row level security;
alter table fonts enable row level security;
alter table font_files enable row level security;
alter table folders enable row level security;
alter table photos enable row level security;
alter table share_links enable row level security;
alter table upload_tokens enable row level security;
alter table download_log enable row level security;
alter table upload_log enable row level security;

-- Profiles: everyone authenticated can read (names shown in UI); only admins
-- change roles; users may update their own display name.
create policy "profiles readable by authenticated"
  on profiles for select to authenticated using (true);
create policy "profiles self-update"
  on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = current_app_role());
create policy "profiles admin-update"
  on profiles for update to authenticated
  using (current_app_role() = 'admin');

-- Read access for every authenticated user (viewer and up).
create policy "spaces readable" on spaces for select to authenticated using (true);
create policy "files readable" on files for select to authenticated using (true);
create policy "kits readable" on kits for select to authenticated using (true);
create policy "kit_assets readable" on kit_assets for select to authenticated using (true);
create policy "palettes readable" on palettes for select to authenticated using (true);
create policy "colors readable" on colors for select to authenticated using (true);
create policy "fonts readable" on fonts for select to authenticated using (true);
create policy "font_files readable" on font_files for select to authenticated using (true);
create policy "folders readable" on folders for select to authenticated using (true);
create policy "photos readable" on photos for select to authenticated using (true);
create policy "share_links readable" on share_links for select to authenticated using (true);
create policy "upload_tokens readable" on upload_tokens for select to authenticated
  using (current_app_role() in ('admin', 'editor'));

-- Write access: editors and admins.
create policy "files writable" on files for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "kits writable" on kits for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "kits updatable" on kits for update to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "kit_assets writable" on kit_assets for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "kit_assets updatable" on kit_assets for update to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "palettes writable" on palettes for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "palettes updatable" on palettes for update to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "colors writable" on colors for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "colors updatable" on colors for update to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "fonts writable" on fonts for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "fonts updatable" on fonts for update to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "font_files writable" on font_files for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "folders writable" on folders for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "folders updatable" on folders for update to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "photos writable" on photos for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "photos updatable" on photos for update to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "share_links writable" on share_links for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "share_links updatable" on share_links for update to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "upload_tokens writable" on upload_tokens for insert to authenticated
  with check (current_app_role() = 'admin');
create policy "upload_tokens updatable" on upload_tokens for update to authenticated
  using (current_app_role() = 'admin');

-- Deletes: admins delete anything; editors delete their own photo uploads.
create policy "photos deletable" on photos for delete to authenticated
  using (
    current_app_role() = 'admin'
    or (current_app_role() = 'editor' and uploaded_by = auth.uid())
  );
create policy "files deletable" on files for delete to authenticated
  using (
    current_app_role() = 'admin'
    or (current_app_role() = 'editor' and uploaded_by = auth.uid())
  );
create policy "kits deletable" on kits for delete to authenticated
  using (current_app_role() = 'admin');
create policy "kit_assets deletable" on kit_assets for delete to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "palettes deletable" on palettes for delete to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "colors deletable" on colors for delete to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "fonts deletable" on fonts for delete to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "font_files deletable" on font_files for delete to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "folders deletable" on folders for delete to authenticated
  using (current_app_role() = 'admin');
create policy "share_links deletable" on share_links for delete to authenticated
  using (current_app_role() = 'admin');
create policy "upload_tokens deletable" on upload_tokens for delete to authenticated
  using (current_app_role() = 'admin');

-- Audit logs: admins read; writes happen via service role only.
create policy "download_log admin-read" on download_log for select to authenticated
  using (current_app_role() = 'admin');
create policy "upload_log admin-read" on upload_log for select to authenticated
  using (current_app_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Seed: the single v1 space
-- ---------------------------------------------------------------------------

insert into spaces (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Soteria', 'soteria')
on conflict (slug) do nothing;
