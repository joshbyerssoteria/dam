-- Every kit gets one primary source file (e.g. the master .ai).
-- Displayed at the top of the kit; the kit's cover image doubles as its
-- visual thumbnail since source formats aren't previewable.

alter table kits
  add column source_file_id uuid references files (id) on delete set null;
