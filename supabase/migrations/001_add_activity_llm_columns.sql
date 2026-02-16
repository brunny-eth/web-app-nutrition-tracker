-- Add LLM-estimated activity columns to daily_activity
-- Run this in Supabase SQL Editor

ALTER TABLE daily_activity
  ADD COLUMN description text,
  ADD COLUMN multiplier double precision,
  ADD COLUMN multiplier_low double precision,
  ADD COLUMN multiplier_high double precision,
  ADD COLUMN summary text;

-- Make activity_level_id nullable for new-style entries
ALTER TABLE daily_activity ALTER COLUMN activity_level_id DROP NOT NULL;
ALTER TABLE daily_activity ALTER COLUMN activity_level_id DROP DEFAULT;
