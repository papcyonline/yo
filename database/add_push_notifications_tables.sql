-- Migration: Add push notification system tables
-- This migration adds tables for push notification tokens, settings, and history

-- Create push_tokens table
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_id TEXT DEFAULT 'unknown',
    platform TEXT DEFAULT 'unknown',
    app_version TEXT DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, token),
    CHECK (token != '')
);

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    messages BOOLEAN DEFAULT true,
    matches BOOLEAN DEFAULT true,
    friend_requests BOOLEAN DEFAULT true,
    family_connections BOOLEAN DEFAULT true,
    quiet_hours JSONB DEFAULT '{"enabled": false, "start": "22:00", "end": "08:00"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id)
);

-- Create notification_history table
CREATE TABLE IF NOT EXISTS public.notification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CHECK (title != '' AND body != '')
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON public.push_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens(token);

CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON public.notification_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON public.notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_is_read ON public.notification_history(is_read);
CREATE INDEX IF NOT EXISTS idx_notification_history_type ON public.notification_history(type);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON public.notification_history(sent_at);

-- Add comments for documentation
COMMENT ON TABLE public.push_tokens IS 'Stores push notification tokens for devices';
COMMENT ON COLUMN public.push_tokens.user_id IS 'Reference to the user';
COMMENT ON COLUMN public.push_tokens.token IS 'Expo push notification token';
COMMENT ON COLUMN public.push_tokens.device_id IS 'Device identifier';
COMMENT ON COLUMN public.push_tokens.platform IS 'Device platform (ios/android)';
COMMENT ON COLUMN public.push_tokens.is_active IS 'Whether token is active and should receive notifications';

COMMENT ON TABLE public.notification_settings IS 'User notification preferences';
COMMENT ON COLUMN public.notification_settings.user_id IS 'Reference to the user';
COMMENT ON COLUMN public.notification_settings.enabled IS 'Master switch for all notifications';
COMMENT ON COLUMN public.notification_settings.quiet_hours IS 'JSON object with quiet hours configuration';

COMMENT ON TABLE public.notification_history IS 'History of sent push notifications';
COMMENT ON COLUMN public.notification_history.user_id IS 'Reference to the user';
COMMENT ON COLUMN public.notification_history.type IS 'Type of notification (message, match, friend_request, etc.)';
COMMENT ON COLUMN public.notification_history.data IS 'Additional notification data as JSON';

-- Enable Row Level Security (RLS)
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for push_tokens
CREATE POLICY "Users can view own push tokens" ON public.push_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens" ON public.push_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens" ON public.push_tokens
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens" ON public.push_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for notification_settings
CREATE POLICY "Users can view own notification settings" ON public.notification_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings" ON public.notification_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings" ON public.notification_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification settings" ON public.notification_settings
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for notification_history
CREATE POLICY "Users can view own notification history" ON public.notification_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification history" ON public.notification_history
    FOR UPDATE USING (auth.uid() = user_id);

-- Create functions to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER trigger_update_push_tokens_updated_at
    BEFORE UPDATE ON public.push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_push_tokens_updated_at();

CREATE TRIGGER trigger_update_notification_settings_updated_at
    BEFORE UPDATE ON public.notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_settings_updated_at();

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL ON public.push_tokens TO authenticated;
-- GRANT ALL ON public.push_tokens TO service_role;
-- GRANT ALL ON public.notification_settings TO authenticated;
-- GRANT ALL ON public.notification_settings TO service_role;
-- GRANT ALL ON public.notification_history TO authenticated;
-- GRANT ALL ON public.notification_history TO service_role;

COMMIT;