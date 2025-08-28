-- ================================================
-- COMPREHENSIVE PROFILE DATA MIGRATION
-- ================================================
-- This migration ensures all necessary columns exist and syncs data properly

-- Step 1: Add missing columns to users table
-- ================================================

-- Add nickname column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'nickname') THEN
        ALTER TABLE public.users ADD COLUMN nickname VARCHAR(100);
    END IF;
END $$;

-- Add JSONB columns for structured data
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'family_info') THEN
        ALTER TABLE public.users ADD COLUMN family_info JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'personal_info') THEN
        ALTER TABLE public.users ADD COLUMN personal_info JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'education') THEN
        ALTER TABLE public.users ADD COLUMN education JSONB DEFAULT '{}';
    END IF;
END $$;

-- Ensure bio column exists (it should already exist from FINAL_COMPLETE_SCHEMA)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') THEN
        ALTER TABLE public.users ADD COLUMN bio TEXT;
    END IF;
END $$;

-- Step 2: Create indexes for better performance
-- ================================================
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
CREATE INDEX IF NOT EXISTS idx_users_family_info ON users USING GIN (family_info);
CREATE INDEX IF NOT EXISTS idx_users_personal_info ON users USING GIN (personal_info);
CREATE INDEX IF NOT EXISTS idx_users_education ON users USING GIN (education);

-- Step 3: Add completed column to progressive_profiles if missing
-- ================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'progressive_profiles' AND column_name = 'completed') THEN
        ALTER TABLE public.progressive_profiles ADD COLUMN completed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Step 4: Create or replace the sync function
-- ================================================
CREATE OR REPLACE FUNCTION sync_progressive_to_user_profile()
RETURNS void AS $$
DECLARE
    profile_record RECORD;
    user_updates JSONB;
    family_data JSONB;
    personal_data JSONB;
    education_data JSONB;
BEGIN
    -- Loop through all progressive profiles
    FOR profile_record IN SELECT * FROM progressive_profiles
    LOOP
        -- Initialize JSONB objects
        family_data := '{}'::JSONB;
        personal_data := '{}'::JSONB;
        education_data := '{}'::JSONB;
        
        -- Extract family info
        IF profile_record.answers ? 'father_name' THEN
            family_data := family_data || jsonb_build_object('father_name', profile_record.answers->>'father_name');
        END IF;
        IF profile_record.answers ? 'mother_name' THEN
            family_data := family_data || jsonb_build_object('mother_name', profile_record.answers->>'mother_name');
        END IF;
        IF profile_record.answers ? 'siblings_relatives' THEN
            family_data := family_data || jsonb_build_object('siblings', profile_record.answers->>'siblings_relatives');
        END IF;
        IF profile_record.answers ? 'family_stories' THEN
            family_data := family_data || jsonb_build_object('origin_stories', profile_record.answers->>'family_stories');
        END IF;
        
        -- Extract personal info
        IF profile_record.answers ? 'childhood_memories' THEN
            personal_data := personal_data || jsonb_build_object('childhood_memories', profile_record.answers->>'childhood_memories');
        END IF;
        IF profile_record.answers ? 'kindergarten_memories' THEN
            personal_data := personal_data || jsonb_build_object('kindergarten_memories', profile_record.answers->>'kindergarten_memories');
        END IF;
        IF profile_record.answers ? 'childhood_friends' THEN
            personal_data := personal_data || jsonb_build_object('childhood_friends', profile_record.answers->>'childhood_friends');
        END IF;
        IF profile_record.answers ? 'languages_dialects' THEN
            personal_data := personal_data || jsonb_build_object('languages', profile_record.answers->>'languages_dialects');
        END IF;
        
        -- Extract education info
        IF profile_record.answers ? 'primary_school' THEN
            education_data := education_data || jsonb_build_object('primary_school', profile_record.answers->>'primary_school');
        END IF;
        IF profile_record.answers ? 'secondary_school' THEN
            education_data := education_data || jsonb_build_object('high_school', profile_record.answers->>'secondary_school');
        END IF;
        IF profile_record.answers ? 'university_college' THEN
            education_data := education_data || jsonb_build_object('university', profile_record.answers->>'university_college');
        END IF;
        
        -- Update the user record
        UPDATE users SET
            bio = COALESCE(profile_record.answers->>'personal_bio', bio),
            nickname = COALESCE(profile_record.answers->>'childhood_nickname', nickname),
            profile_picture_url = COALESCE(profile_record.answers->>'profile_image', profile_picture_url),
            family_info = CASE WHEN family_data != '{}'::JSONB THEN family_data ELSE family_info END,
            personal_info = CASE WHEN personal_data != '{}'::JSONB THEN personal_data ELSE personal_info END,
            education = CASE WHEN education_data != '{}'::JSONB THEN education_data ELSE education_info END,
            profile_completion_percentage = COALESCE(profile_record.completion_percentage, profile_completion_percentage),
            updated_at = NOW()
        WHERE id = profile_record.user_id;
        
        RAISE NOTICE 'Synced user %', profile_record.user_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Execute the sync function
-- ================================================
SELECT sync_progressive_to_user_profile();

-- Step 6: Create trigger to auto-sync on progressive_profiles updates
-- ================================================
CREATE OR REPLACE FUNCTION auto_sync_progressive_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract and sync data to users table
    UPDATE users SET
        bio = COALESCE(NEW.answers->>'personal_bio', bio),
        nickname = COALESCE(NEW.answers->>'childhood_nickname', nickname),
        profile_picture_url = COALESCE(NEW.answers->>'profile_image', profile_picture_url),
        profile_completion_percentage = COALESCE(NEW.completion_percentage, profile_completion_percentage),
        updated_at = NOW()
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_progressive_on_update ON progressive_profiles;

-- Create the trigger
CREATE TRIGGER sync_progressive_on_update
    AFTER INSERT OR UPDATE ON progressive_profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_sync_progressive_profile();

-- Step 7: Verify the sync worked
-- ================================================
SELECT 
    u.id,
    u.email,
    u.bio,
    u.nickname,
    u.profile_picture_url,
    u.family_info,
    u.personal_info,
    u.education,
    pp.completion_percentage
FROM users u
LEFT JOIN progressive_profiles pp ON u.id = pp.user_id
WHERE pp.user_id IS NOT NULL;