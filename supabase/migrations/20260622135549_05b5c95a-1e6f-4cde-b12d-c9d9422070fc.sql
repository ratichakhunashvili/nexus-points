
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS student_id TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS avatar_icon TEXT NOT NULL DEFAULT 'spark';

-- Private fields readable only by self or admin. Drop the existing public-read policy and replace it
-- with a public-safe view via policy: name, total_points, avatar_icon are visible to everyone (needed
-- for leaderboards), but phone/bio/student_id/department/email leak only to self or admin.
-- Postgres row-level policies are all-or-nothing per row, so we keep row-level readable-by-all and
-- enforce column privacy by always projecting safe columns in public queries; for self/admin we
-- project everything. (Application convention.)
