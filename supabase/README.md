# Supabase database conventions

`migrations/` contains ordered forward-only SQL migrations. M0 defines only private medical-knowledge governance structures. Patient data tables, Auth integration, RLS policies, and Storage buckets begin in later approved milestones.

Run no seed automatically. `seed.demo.sql` is intentionally data-free in M0 and must never be used in production.
