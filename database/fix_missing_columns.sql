-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb;

-- Add missing columns to progressive_profiles table  
ALTER TABLE progressive_profiles ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0;

-- Add other commonly referenced columns that might be missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS education JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS family_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_info JSONB DEFAULT '{}'::jsonb;

-- Update any NULL values to proper defaults
UPDATE users SET interests = '[]'::jsonb WHERE interests IS NULL;
UPDATE users SET bio = '' WHERE bio IS NULL;
UPDATE users SET location = '' WHERE location IS NULL;
UPDATE users SET education = '{}'::jsonb WHERE education IS NULL;
UPDATE users SET family_info = '{}'::jsonb WHERE family_info IS NULL;
UPDATE users SET personal_info = '{}'::jsonb WHERE personal_info IS NULL;

UPDATE progressive_profiles SET completion_percentage = 0 WHERE completion_percentage IS NULL;