-- Migration: Add Security Settings Table
-- Run this to add user_security_settings table to your database
-- Date: 2025-08-17

-- Add user security settings table
CREATE TABLE IF NOT EXISTS user_security_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    biometric_enabled BOOLEAN DEFAULT TRUE,
    login_alerts BOOLEAN DEFAULT TRUE,
    session_timeout INTEGER DEFAULT 5, -- minutes for app lock, 0 = immediately, -1 = never
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_security_settings_user_id ON user_security_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_security_settings_2fa ON user_security_settings(two_factor_enabled);

-- Verify the migration by showing table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_security_settings' 
ORDER BY ordinal_position;

-- Show sample data (will be empty initially)
SELECT COUNT(*) as total_security_settings FROM user_security_settings;