-- Sermon Series: a static (system) kit folder that cannot be renamed or
-- deleted, has its own icon, and holds date-ranged kits — one kit per series.

-- ---------------------------------------------------------------------------
-- Kit folder kind. 'standard' folders are user-managed; 'sermon_series' is a
-- single static folder per space with its own icon and date-ranged kits.
-- ---------------------------------------------------------------------------

alter table kit_folders
  add column kind text not null default 'standard'
    check (kind in ('standard', 'sermon_series'));

-- ---------------------------------------------------------------------------
-- Optional date range shown beneath a sermon-series kit's title. Nullable and
-- only populated for kits inside the Sermon Series folder.
-- ---------------------------------------------------------------------------

alter table kits add column starts_on date;
alter table kits add column ends_on date;

-- ---------------------------------------------------------------------------
-- Promote any existing "Sermon Series" folder to the static kind, then ensure
-- every space has exactly one.
-- ---------------------------------------------------------------------------

update kit_folders
  set kind = 'sermon_series'
  where lower(name) = 'sermon series';

insert into kit_folders (space_id, parent_id, slug, name, kind)
select s.id, null, 'sermon-series', 'Sermon Series', 'sermon_series'
from spaces s
where not exists (
  select 1 from kit_folders kf
  where kf.space_id = s.id and kf.kind = 'sermon_series'
);
