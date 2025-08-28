-- ============================================
-- YO! APP - BULLETPROOF COMPLETE DATABASE SCHEMA
-- Version: 1.3
-- Description: Complete database schema with safe table creation, column additions, and conditional indexing
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- CORE USER SYSTEM
-- ============================================

-- Main users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    username VARCHAR(100) UNIQUE,
    password_hash TEXT,
    
    -- Profile Information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(100),
    date_of_birth DATE,
    gender VARCHAR(20),
    bio TEXT,
    profile_picture_url TEXT,
    cover_photo_url TEXT,
    
    -- Location
    location VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Preferences
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}',
    privacy_settings JSONB DEFAULT '{"profile_visible": true, "show_location": false}',
    
    -- Authentication & Security
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    google_id VARCHAR(255),
    facebook_id VARCHAR(255),
    
    -- Profile Completion
    profile_complete BOOLEAN DEFAULT false,
    profile_completion_percentage INTEGER DEFAULT 0,
    onboarding_completed BOOLEAN DEFAULT false,
    
    -- Activity Tracking
    is_active BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE,
    total_points INTEGER DEFAULT 0,
    achievement_level VARCHAR(50) DEFAULT 'beginner',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to users table if they don't exist
DO $$ 
BEGIN
    -- Location columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'city') THEN
        ALTER TABLE public.users ADD COLUMN city VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'state') THEN
        ALTER TABLE public.users ADD COLUMN state VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'country') THEN
        ALTER TABLE public.users ADD COLUMN country VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'latitude') THEN
        ALTER TABLE public.users ADD COLUMN latitude DECIMAL(10, 8);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'longitude') THEN
        ALTER TABLE public.users ADD COLUMN longitude DECIMAL(11, 8);
    END IF;
    
    -- Auth columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'refresh_token') THEN
        ALTER TABLE public.users ADD COLUMN refresh_token TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'token_expires_at') THEN
        ALTER TABLE public.users ADD COLUMN token_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login_at') THEN
        ALTER TABLE public.users ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'login_attempts') THEN
        ALTER TABLE public.users ADD COLUMN login_attempts INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'locked_until') THEN
        ALTER TABLE public.users ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Activity columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
        ALTER TABLE public.users ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_online') THEN
        ALTER TABLE public.users ADD COLUMN is_online BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_seen') THEN
        ALTER TABLE public.users ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'total_points') THEN
        ALTER TABLE public.users ADD COLUMN total_points INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'achievement_level') THEN
        ALTER TABLE public.users ADD COLUMN achievement_level VARCHAR(50) DEFAULT 'beginner';
    END IF;
    
    -- Profile columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'display_name') THEN
        ALTER TABLE public.users ADD COLUMN display_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') THEN
        ALTER TABLE public.users ADD COLUMN bio TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_picture_url') THEN
        ALTER TABLE public.users ADD COLUMN profile_picture_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'cover_photo_url') THEN
        ALTER TABLE public.users ADD COLUMN cover_photo_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'date_of_birth') THEN
        ALTER TABLE public.users ADD COLUMN date_of_birth DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gender') THEN
        ALTER TABLE public.users ADD COLUMN gender VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_complete') THEN
        ALTER TABLE public.users ADD COLUMN profile_complete BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_completion_percentage') THEN
        ALTER TABLE public.users ADD COLUMN profile_completion_percentage INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'onboarding_completed') THEN
        ALTER TABLE public.users ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
    END IF;
    
    -- Preference columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'preferred_language') THEN
        ALTER TABLE public.users ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'en';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'timezone') THEN
        ALTER TABLE public.users ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'notification_preferences') THEN
        ALTER TABLE public.users ADD COLUMN notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'privacy_settings') THEN
        ALTER TABLE public.users ADD COLUMN privacy_settings JSONB DEFAULT '{"profile_visible": true, "show_location": false}';
    END IF;
    
    -- Social login columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'google_id') THEN
        ALTER TABLE public.users ADD COLUMN google_id VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'facebook_id') THEN
        ALTER TABLE public.users ADD COLUMN facebook_id VARCHAR(255);
    END IF;
END $$;

-- ============================================
-- AUTHENTICATION TABLES
-- ============================================

-- Phone verification codes
CREATE TABLE IF NOT EXISTS public.phone_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(10) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT false,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email verification codes
CREATE TABLE IF NOT EXISTS public.email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT,
    code VARCHAR(10) NOT NULL,
    verification_code VARCHAR(10),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT false,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS public.password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    code VARCHAR(10),
    token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PROGRESSIVE PROFILE SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS public.progressive_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Progress Tracking
    current_phase VARCHAR(50) DEFAULT 'essential',
    current_question_index INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    completion_percentage INTEGER DEFAULT 0,
    
    -- Profile Data
    answers JSONB DEFAULT '{}',
    answered_questions TEXT[] DEFAULT ARRAY[]::TEXT[],
    skipped_questions TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Preferences
    display_name VARCHAR(100),
    username_preference VARCHAR(20) DEFAULT 'real_name',
    
    -- AI Processing
    ai_processed BOOLEAN DEFAULT false,
    ai_insights JSONB DEFAULT '{}',
    personality_traits JSONB DEFAULT '{}',
    interests JSONB DEFAULT '{}',
    values JSONB DEFAULT '{}',
    
    -- Metadata
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AI MATCHING SYSTEM
-- ============================================

-- User matches generated by AI
CREATE TABLE IF NOT EXISTS public.user_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    matched_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('family', 'friend', 'romantic', 'professional')),
    
    -- Match Scoring
    match_score DECIMAL(5, 2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    compatibility_scores JSONB DEFAULT '{}',
    common_interests TEXT[],
    
    -- Match Reasoning
    match_reason TEXT,
    ai_explanation TEXT,
    key_similarities JSONB DEFAULT '{}',
    
    -- User Interaction
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'connected', 'blocked')),
    user_action VARCHAR(20),
    matched_user_action VARCHAR(20),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    connected_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure unique matches
    UNIQUE(user_id, matched_user_id)
);

-- Match analytics and feedback
CREATE TABLE IF NOT EXISTS public.match_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES public.user_matches(id) ON DELETE CASCADE,
    
    -- Interaction Metrics
    views_count INTEGER DEFAULT 0,
    profile_visits INTEGER DEFAULT 0,
    messages_exchanged INTEGER DEFAULT 0,
    
    -- Quality Metrics
    interaction_quality_score DECIMAL(5, 2),
    response_time_avg INTEGER,
    engagement_level VARCHAR(20),
    
    -- Timestamps
    first_viewed_at TIMESTAMP WITH TIME ZONE,
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI processing queue
CREATE TABLE IF NOT EXISTS public.ai_processing_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    processing_type VARCHAR(50) NOT NULL,
    
    -- Processing Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER DEFAULT 5,
    retry_count INTEGER DEFAULT 0,
    
    -- Data
    input_data JSONB DEFAULT '{}',
    output_data JSONB,
    error_message TEXT,
    
    -- Timestamps
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Match feedback from users
CREATE TABLE IF NOT EXISTS public.match_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.user_matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Feedback
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_type VARCHAR(50),
    feedback_text TEXT,
    improvement_suggestions TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(match_id, user_id)
);

-- ============================================
-- NOTIFICATIONS SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Notification Details
    notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN ('match', 'message', 'system', 'welcome', 'achievement', 'reminder')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- System-wide messages
CREATE TABLE IF NOT EXISTS public.system_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'info' CHECK (message_type IN ('info', 'warning', 'error', 'success')),
    is_active BOOLEAN DEFAULT true,
    target_users JSONB DEFAULT '{"all": true}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- CHAT & MESSAGING SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_type VARCHAR(20) DEFAULT 'direct' CHECK (conversation_type IN ('direct', 'group', 'ai')),
    
    -- Participants
    participants UUID[] NOT NULL,
    created_by UUID REFERENCES public.users(id),
    
    -- Group Chat Details
    name VARCHAR(255),
    description TEXT,
    avatar_url TEXT,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    is_archived BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    
    -- Metadata
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to conversations table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'conversation_type') THEN
        ALTER TABLE public.conversations ADD COLUMN conversation_type VARCHAR(20) DEFAULT 'direct';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'participants') THEN
        ALTER TABLE public.conversations ADD COLUMN participants UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'created_by') THEN
        ALTER TABLE public.conversations ADD COLUMN created_by UUID REFERENCES public.users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'name') THEN
        ALTER TABLE public.conversations ADD COLUMN name VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'description') THEN
        ALTER TABLE public.conversations ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'avatar_url') THEN
        ALTER TABLE public.conversations ADD COLUMN avatar_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'settings') THEN
        ALTER TABLE public.conversations ADD COLUMN settings JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'is_archived') THEN
        ALTER TABLE public.conversations ADD COLUMN is_archived BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'is_muted') THEN
        ALTER TABLE public.conversations ADD COLUMN is_muted BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'last_message_at') THEN
        ALTER TABLE public.conversations ADD COLUMN last_message_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id),
    
    -- Message Content
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'voice', 'file', 'location', 'system')),
    content TEXT,
    media_urls TEXT[],
    
    -- Status
    is_edited BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    read_by UUID[] DEFAULT ARRAY[]::UUID[],
    delivered_to UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Reply
    reply_to_message_id UUID REFERENCES public.messages(id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Add missing columns to messages table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'conversation_id') THEN
        ALTER TABLE public.messages ADD COLUMN conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'sender_id') THEN
        ALTER TABLE public.messages ADD COLUMN sender_id UUID REFERENCES public.users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') THEN
        ALTER TABLE public.messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'content') THEN
        ALTER TABLE public.messages ADD COLUMN content TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'media_urls') THEN
        ALTER TABLE public.messages ADD COLUMN media_urls TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_edited') THEN
        ALTER TABLE public.messages ADD COLUMN is_edited BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_deleted') THEN
        ALTER TABLE public.messages ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'read_by') THEN
        ALTER TABLE public.messages ADD COLUMN read_by UUID[] DEFAULT ARRAY[]::UUID[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'delivered_to') THEN
        ALTER TABLE public.messages ADD COLUMN delivered_to UUID[] DEFAULT ARRAY[]::UUID[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'reply_to_message_id') THEN
        ALTER TABLE public.messages ADD COLUMN reply_to_message_id UUID REFERENCES public.messages(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'edited_at') THEN
        ALTER TABLE public.messages ADD COLUMN edited_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'deleted_at') THEN
        ALTER TABLE public.messages ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- ============================================
-- COMMUNITY & SOCIAL FEATURES
-- ============================================

CREATE TABLE IF NOT EXISTS public.communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Community Details
    community_type VARCHAR(50),
    category VARCHAR(100),
    tags TEXT[],
    
    -- Settings
    is_public BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,
    member_limit INTEGER,
    
    -- Media
    avatar_url TEXT,
    cover_image_url TEXT,
    
    -- Stats
    member_count INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    
    -- Creator
    created_by UUID NOT NULL REFERENCES public.users(id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.community_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Membership Details
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'banned')),
    
    -- Activity
    contribution_score INTEGER DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID REFERENCES public.users(id),
    
    UNIQUE(community_id, user_id)
);

-- Friendships
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Friendship Details
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    friendship_type VARCHAR(20) DEFAULT 'friend',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(user_id, friend_id)
);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to tables (drop existing first)
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_progressive_profiles_updated_at ON public.progressive_profiles;
CREATE TRIGGER update_progressive_profiles_updated_at BEFORE UPDATE ON public.progressive_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_matches_updated_at ON public.user_matches;
CREATE TRIGGER update_user_matches_updated_at BEFORE UPDATE ON public.user_matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_communities_updated_at ON public.communities;
CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON public.communities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INDEXES FOR PERFORMANCE (ONLY CREATE IF COLUMNS EXIST)
-- ============================================

-- User indexes (conditional creation)
DO $$
BEGIN
    -- Only create location index if all columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'city') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'state') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'country') THEN
        CREATE INDEX IF NOT EXISTS idx_users_location ON public.users(city, state, country);
    END IF;
    
    -- Only create activity index if columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_online') THEN
        CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active, is_online);
    END IF;
END $$;

-- Basic indexes that should always work
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- Authentication indexes (conditional creation)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'phone_verifications') THEN
        CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON public.phone_verifications(phone);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_verifications') THEN
        CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON public.email_verifications(user_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_resets') THEN
        CREATE INDEX IF NOT EXISTS idx_password_resets_token ON public.password_resets(token);
    END IF;
END $$;

-- Progressive profile indexes (conditional creation)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'progressive_profiles') THEN
        CREATE INDEX IF NOT EXISTS idx_progressive_profiles_user ON public.progressive_profiles(user_id);
        CREATE INDEX IF NOT EXISTS idx_progressive_profiles_phase ON public.progressive_profiles(current_phase);
    END IF;
END $$;

-- Matching indexes (conditional creation)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_matches') THEN
        CREATE INDEX IF NOT EXISTS idx_user_matches_user ON public.user_matches(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_matches_matched_user ON public.user_matches(matched_user_id);
        CREATE INDEX IF NOT EXISTS idx_user_matches_status ON public.user_matches(status);
        CREATE INDEX IF NOT EXISTS idx_user_matches_type ON public.user_matches(match_type);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_processing_queue') THEN
        CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON public.ai_processing_queue(status, priority);
    END IF;
END $$;

-- Notification indexes (conditional creation)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
        CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
    END IF;
END $$;

-- Message indexes (conditional creation - check both tables and columns)
DO $$
BEGIN
    -- Only create message indexes if tables and columns exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'conversation_id') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'sender_id') AND
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'participants') THEN
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations USING GIN(participants);
    END IF;
END $$;

-- Community indexes (conditional creation)
DO $$
BEGIN
    -- Only create community indexes if tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'community_memberships') THEN
        CREATE INDEX IF NOT EXISTS idx_community_members_user ON public.community_memberships(user_id);
        CREATE INDEX IF NOT EXISTS idx_community_members_community ON public.community_memberships(community_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'friendships') THEN
        CREATE INDEX IF NOT EXISTS idx_friendships_user ON public.friendships(user_id, status);
    END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY (RLS) - DISABLED FOR DEVELOPMENT
-- ============================================

-- Disable RLS for development (enable and configure for production)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.progressive_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_resets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_processing_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_feedback DISABLE ROW LEVEL SECURITY;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant all permissions for development
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- ============================================
-- INITIAL DATA (Optional)
-- ============================================

-- Insert a default system message
INSERT INTO public.system_messages (title, message, message_type, is_active)
VALUES ('Welcome to Yo!', 'Welcome to the Yo! family matching platform. Complete your profile to get started!', 'info', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Database schema created successfully!';
    RAISE NOTICE 'Tables created: users, progressive_profiles, user_matches, notifications, messages, communities, and more.';
    RAISE NOTICE 'RLS is DISABLED for development. Enable it for production with proper policies.';
    RAISE NOTICE 'Schema version: 1.3 - Bulletproof with table/column checking and comprehensive fixes';
END $$;