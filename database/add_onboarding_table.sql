-- Migration: Add onboarding progress tracking table
-- This table tracks user progress through the onboarding flow

-- Create user_onboarding_progress table
CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    current_step INTEGER DEFAULT 1,
    completed_steps TEXT[] DEFAULT '{}',
    is_completed BOOLEAN DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id),
    CHECK (current_step >= 1 AND current_step <= 10)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_user_id 
ON public.user_onboarding_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_completed 
ON public.user_onboarding_progress(is_completed);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_current_step 
ON public.user_onboarding_progress(current_step);

-- Add comments for documentation
COMMENT ON TABLE public.user_onboarding_progress IS 'Tracks user progress through the onboarding flow';
COMMENT ON COLUMN public.user_onboarding_progress.user_id IS 'Reference to the user';
COMMENT ON COLUMN public.user_onboarding_progress.current_step IS 'Current step in onboarding (1-10)';
COMMENT ON COLUMN public.user_onboarding_progress.completed_steps IS 'Array of completed step IDs';
COMMENT ON COLUMN public.user_onboarding_progress.is_completed IS 'Whether onboarding is complete';
COMMENT ON COLUMN public.user_onboarding_progress.last_updated IS 'When progress was last updated';

-- Enable Row Level Security (RLS) if needed
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see and modify their own onboarding progress
CREATE POLICY "Users can view own onboarding progress" ON public.user_onboarding_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding progress" ON public.user_onboarding_progress
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding progress" ON public.user_onboarding_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own onboarding progress" ON public.user_onboarding_progress
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_onboarding_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_onboarding_progress_updated_at
    BEFORE UPDATE ON public.user_onboarding_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_onboarding_progress_updated_at();

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL ON public.user_onboarding_progress TO authenticated;
-- GRANT ALL ON public.user_onboarding_progress TO service_role;

COMMIT;