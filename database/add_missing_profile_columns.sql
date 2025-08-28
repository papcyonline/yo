-- Add missing profile columns to users table
-- These columns are needed for the profile update functionality

DO $$ 
BEGIN
    -- Add current_address column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'current_address') THEN
        ALTER TABLE public.users ADD COLUMN current_address VARCHAR(500);
        RAISE NOTICE 'Added current_address column to users table';
    END IF;
    
    -- Add father_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'father_name') THEN
        ALTER TABLE public.users ADD COLUMN father_name VARCHAR(200);
        RAISE NOTICE 'Added father_name column to users table';
    END IF;
    
    -- Add mother_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'mother_name') THEN
        ALTER TABLE public.users ADD COLUMN mother_name VARCHAR(200);
        RAISE NOTICE 'Added mother_name column to users table';
    END IF;
    
    -- Add profession column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profession') THEN
        ALTER TABLE public.users ADD COLUMN profession VARCHAR(200);
        RAISE NOTICE 'Added profession column to users table';
    END IF;
    
    -- Add university column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'university') THEN
        ALTER TABLE public.users ADD COLUMN university VARCHAR(300);
        RAISE NOTICE 'Added university column to users table';
    END IF;
    
    -- Add full_name computed column for easier queries
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name') THEN
        ALTER TABLE public.users ADD COLUMN full_name VARCHAR(300);
        RAISE NOTICE 'Added full_name column to users table';
    END IF;
    
    -- Create index for name searches
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_names') THEN
        CREATE INDEX idx_users_names ON public.users (full_name, first_name, last_name);
        RAISE NOTICE 'Created index for name searches';
    END IF;
    
    -- Create index for family searches
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_family') THEN
        CREATE INDEX idx_users_family ON public.users (father_name, mother_name);
        RAISE NOTICE 'Created index for family searches';
    END IF;

END $$;