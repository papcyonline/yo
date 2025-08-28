-- Migration: Add Privacy Settings Columns to user_preferences table
-- Run this if your user_preferences table already exists without the privacy columns
-- Date: 2025-08-17

-- Add missing privacy settings columns to existing user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_friend_requests BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_last_seen BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_message_requests BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_phone_number BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_tagging BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS data_analytics BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ad_personalization BOOLEAN DEFAULT FALSE;

-- Create additional indexes for privacy columns performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_privacy_level ON user_preferences(privacy_level);
CREATE INDEX IF NOT EXISTS idx_user_preferences_location_enabled ON user_preferences(location_enabled);
CREATE INDEX IF NOT EXISTS idx_user_preferences_show_online_status ON user_preferences(show_online_status);

-- Update existing records to have default privacy values
UPDATE user_preferences 
SET 
    show_online_status = COALESCE(show_online_status, TRUE),
    allow_friend_requests = COALESCE(allow_friend_requests, TRUE),
    show_last_seen = COALESCE(show_last_seen, TRUE),
    allow_message_requests = COALESCE(allow_message_requests, TRUE),
    show_phone_number = COALESCE(show_phone_number, FALSE),
    show_email = COALESCE(show_email, TRUE),
    allow_tagging = COALESCE(allow_tagging, TRUE),
    data_analytics = COALESCE(data_analytics, TRUE),
    ad_personalization = COALESCE(ad_personalization, FALSE),
    updated_at = NOW()
WHERE id IS NOT NULL;

-- Verify the migration by showing column info
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
  AND column_name IN (
    'show_online_status', 'allow_friend_requests', 'show_last_seen', 
    'allow_message_requests', 'show_phone_number', 'show_email', 
    'allow_tagging', 'data_analytics', 'ad_personalization'
  )
ORDER BY column_name;

-- Show sample data to verify defaults were applied
SELECT 
    user_id,
    show_online_status,
    allow_friend_requests,
    show_last_seen,
    allow_message_requests,
    show_phone_number,
    show_email,
    allow_tagging,
    data_analytics,
    ad_personalization,
    updated_at
FROM user_preferences 
LIMIT 3;