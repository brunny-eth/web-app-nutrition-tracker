-- Nutrition Tracker Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USER SETTINGS (single user for now, but extensible)
-- ============================================
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Auth (simple password gate)
  password_hash TEXT NOT NULL,
  
  -- User identity
  name TEXT NOT NULL DEFAULT 'User',
  
  -- Body stats for BMR calculation (Mifflin-St Jeor)
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,2),
  age_years INTEGER,
  sex TEXT CHECK (sex IN ('male', 'female')),
  
  -- Goals
  calorie_deficit INTEGER DEFAULT 500, -- subtract from TDEE
  
  -- Timezone
  timezone TEXT DEFAULT 'America/New_York',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ACTIVITY LEVELS (reference table)
-- ============================================
CREATE TABLE activity_levels (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  multiplier DECIMAL(4,3) NOT NULL,
  multiplier_low DECIMAL(4,3) NOT NULL,
  multiplier_high DECIMAL(4,3) NOT NULL
);

-- Seed activity levels
INSERT INTO activity_levels (id, label, description, multiplier, multiplier_low, multiplier_high) VALUES
  (1, 'Rest day', 'Sedentary, little to no exercise', 1.200, 1.150, 1.250),
  (2, 'Light activity', 'Light exercise or walking', 1.375, 1.300, 1.450),
  (3, 'Moderate activity', 'Moderate exercise', 1.550, 1.500, 1.600),
  (4, 'Active day', 'Hard exercise or physical work', 1.725, 1.650, 1.800),
  (5, 'Very active', 'Very hard exercise or intense physical job', 1.900, 1.800, 2.000);

-- ============================================
-- DAILY ACTIVITY (user's activity selection per day)
-- ============================================
CREATE TABLE daily_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resolved_date DATE NOT NULL UNIQUE, -- YYYY-MM-DD in user timezone
  activity_level_id INTEGER REFERENCES activity_levels(id) DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_activity_date ON daily_activity(resolved_date);

-- ============================================
-- ENTRIES (raw user food logs)
-- ============================================
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- The raw text input from user
  raw_text TEXT NOT NULL,
  
  -- When the entry was created (with timezone)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- The resolved date this entry belongs to (user timezone, immutable)
  -- Determined by: explicit date in text > client timestamp converted to user TZ
  resolved_date DATE NOT NULL,
  
  -- Optional: if user explicitly specified a date
  explicit_date_in_text BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_entries_resolved_date ON entries(resolved_date);

-- ============================================
-- ENTRY ITEMS (parsed food items from LLM)
-- ============================================
CREATE TABLE entry_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  
  -- Food identification
  food_name TEXT NOT NULL,
  
  -- Portion
  grams DECIMAL(7,2),
  grams_low DECIMAL(7,2),
  grams_high DECIMAL(7,2),
  
  -- Calories (with 90% confidence range)
  calories DECIMAL(7,2) NOT NULL,
  calories_low DECIMAL(7,2) NOT NULL,
  calories_high DECIMAL(7,2) NOT NULL,
  
  -- Macros (with 90% confidence range)
  protein_g DECIMAL(6,2) NOT NULL,
  protein_low DECIMAL(6,2) NOT NULL,
  protein_high DECIMAL(6,2) NOT NULL,
  
  carbs_g DECIMAL(6,2) NOT NULL,
  carbs_low DECIMAL(6,2) NOT NULL,
  carbs_high DECIMAL(6,2) NOT NULL,
  
  fat_g DECIMAL(6,2) NOT NULL,
  fat_low DECIMAL(6,2) NOT NULL,
  fat_high DECIMAL(6,2) NOT NULL,
  
  -- Fat breakdown
  saturated_fat_g DECIMAL(6,2) NOT NULL,
  saturated_fat_low DECIMAL(6,2) NOT NULL,
  saturated_fat_high DECIMAL(6,2) NOT NULL,
  
  unsaturated_fat_g DECIMAL(6,2) NOT NULL,
  unsaturated_fat_low DECIMAL(6,2) NOT NULL,
  unsaturated_fat_high DECIMAL(6,2) NOT NULL,
  
  -- Micros
  fiber_g DECIMAL(6,2) DEFAULT 0,
  fiber_low DECIMAL(6,2) DEFAULT 0,
  fiber_high DECIMAL(6,2) DEFAULT 0,
  
  sodium_mg DECIMAL(8,2) DEFAULT 0,
  sodium_low DECIMAL(8,2) DEFAULT 0,
  sodium_high DECIMAL(8,2) DEFAULT 0,
  
  sugar_g DECIMAL(6,2) DEFAULT 0,
  sugar_low DECIMAL(6,2) DEFAULT 0,
  sugar_high DECIMAL(6,2) DEFAULT 0,
  
  -- LLM assumptions for auditability
  assumptions JSONB DEFAULT '[]',
  
  -- Manual override tracking
  has_override BOOLEAN DEFAULT FALSE,
  override_fields JSONB DEFAULT NULL, -- which fields were manually edited
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entry_items_entry_id ON entry_items(entry_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate BMR using Mifflin-St Jeor
CREATE OR REPLACE FUNCTION calculate_bmr(
  weight_kg DECIMAL,
  height_cm DECIMAL,
  age_years INTEGER,
  sex TEXT
) RETURNS DECIMAL AS $$
BEGIN
  IF sex = 'male' THEN
    RETURN (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years) + 5;
  ELSE
    RETURN (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years) - 161;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- VIEWS
-- ============================================

-- Daily totals view (aggregates entry_items by resolved_date)
CREATE OR REPLACE VIEW daily_totals AS
SELECT 
  e.resolved_date,
  COUNT(DISTINCT e.id) as entry_count,
  COUNT(ei.id) as item_count,
  
  -- Calories
  COALESCE(SUM(ei.calories), 0) as total_calories,
  COALESCE(SUM(ei.calories_low), 0) as total_calories_low,
  COALESCE(SUM(ei.calories_high), 0) as total_calories_high,
  
  -- Protein
  COALESCE(SUM(ei.protein_g), 0) as total_protein,
  COALESCE(SUM(ei.protein_low), 0) as total_protein_low,
  COALESCE(SUM(ei.protein_high), 0) as total_protein_high,
  
  -- Carbs
  COALESCE(SUM(ei.carbs_g), 0) as total_carbs,
  COALESCE(SUM(ei.carbs_low), 0) as total_carbs_low,
  COALESCE(SUM(ei.carbs_high), 0) as total_carbs_high,
  
  -- Fat
  COALESCE(SUM(ei.fat_g), 0) as total_fat,
  COALESCE(SUM(ei.fat_low), 0) as total_fat_low,
  COALESCE(SUM(ei.fat_high), 0) as total_fat_high,
  
  -- Saturated Fat
  COALESCE(SUM(ei.saturated_fat_g), 0) as total_saturated_fat,
  COALESCE(SUM(ei.saturated_fat_low), 0) as total_saturated_fat_low,
  COALESCE(SUM(ei.saturated_fat_high), 0) as total_saturated_fat_high,
  
  -- Unsaturated Fat
  COALESCE(SUM(ei.unsaturated_fat_g), 0) as total_unsaturated_fat,
  COALESCE(SUM(ei.unsaturated_fat_low), 0) as total_unsaturated_fat_low,
  COALESCE(SUM(ei.unsaturated_fat_high), 0) as total_unsaturated_fat_high,
  
  -- Fiber
  COALESCE(SUM(ei.fiber_g), 0) as total_fiber,
  COALESCE(SUM(ei.fiber_low), 0) as total_fiber_low,
  COALESCE(SUM(ei.fiber_high), 0) as total_fiber_high,
  
  -- Sodium
  COALESCE(SUM(ei.sodium_mg), 0) as total_sodium,
  COALESCE(SUM(ei.sodium_low), 0) as total_sodium_low,
  COALESCE(SUM(ei.sodium_high), 0) as total_sodium_high,
  
  -- Sugar
  COALESCE(SUM(ei.sugar_g), 0) as total_sugar,
  COALESCE(SUM(ei.sugar_low), 0) as total_sugar_low,
  COALESCE(SUM(ei.sugar_high), 0) as total_sugar_high

FROM entries e
LEFT JOIN entry_items ei ON ei.entry_id = e.id
GROUP BY e.resolved_date
ORDER BY e.resolved_date DESC;

-- ============================================
-- ROW LEVEL SECURITY (disabled for single user, can enable later)
-- ============================================
-- For now, we don't enable RLS since it's single-user with password gate
-- When adding multi-user, add user_id columns and enable RLS policies
