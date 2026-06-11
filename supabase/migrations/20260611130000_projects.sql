-- Projects: shared, nestable collections that REFERENCE photos for a piece
-- of work (sermon series, campaign, print piece). Photos are linked, never
-- moved or copied — deleting a project (or removing a photo from it) only
-- removes the link rows, never the photo or its file.

create table projects (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  parent_id uuid references projects (id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index projects_space_id_idx on projects (space_id);
create index projects_parent_id_idx on projects (parent_id);

create table project_photos (
  project_id uuid not null references projects (id) on delete cascade,
  photo_id uuid not null references photos (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (project_id, photo_id)
);

create index project_photos_photo_id_idx on project_photos (photo_id);

alter table projects enable row level security;
alter table project_photos enable row level security;

-- Projects are team-shared: everyone reads, editors and admins manage.
-- Editors may delete projects too — deletion is safe by design (links only).
create policy "projects readable" on projects for select to authenticated using (true);
create policy "projects writable" on projects for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "projects updatable" on projects for update to authenticated
  using (current_app_role() in ('admin', 'editor'));
create policy "projects deletable" on projects for delete to authenticated
  using (current_app_role() in ('admin', 'editor'));

create policy "project_photos readable" on project_photos for select to authenticated using (true);
create policy "project_photos writable" on project_photos for insert to authenticated
  with check (current_app_role() in ('admin', 'editor'));
create policy "project_photos deletable" on project_photos for delete to authenticated
  using (current_app_role() in ('admin', 'editor'));
