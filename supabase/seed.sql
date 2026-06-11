-- Idempotent seed for local resets. The Soteria space is also seeded by the
-- initial migration so the app works on first deploy. White-label deployments
-- rename this row via `npm run setup` (scripts/setup.mjs).
insert into spaces (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Soteria', 'soteria')
on conflict (slug) do nothing;
