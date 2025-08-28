-- Add missing completed column to progressive_profiles table
-- This fixes the SQL error: there is no unique or exclusion constraint matching the ON CONFLICT specification

DO $$
BEGIN
    -- Add completed column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'progressive_profiles' 
                   AND column_name = 'completed') THEN
        ALTER TABLE public.progressive_profiles 
        ADD COLUMN completed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Update existing rows to have completed = false by default
UPDATE public.progressive_profiles 
SET completed = false 
WHERE completed IS NULL;

COMMIT;