-- ============================================
-- CONNECTION AND FRIEND REQUEST TABLES
-- ============================================

-- Friend Requests table (missing from the schema)
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Request Details
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    message TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(sender_id, receiver_id)
);

-- Connections table (for broader relationship management)
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Connection Details
    connection_type VARCHAR(20) DEFAULT 'friend' CHECK (connection_type IN ('friend', 'family', 'colleague', 'acquaintance')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'deleted')),
    relationship_type VARCHAR(50), -- cousin, uncle, aunt, etc.
    match_percentage INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user1_id, user2_id)
);

-- Match details table (for AI-based matching)
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    matched_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Match Details
    match_type VARCHAR(20) DEFAULT 'family' CHECK (match_type IN ('family', 'friend', 'location', 'interest')),
    match_score INTEGER DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
    confidence_level VARCHAR(10) DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high')),
    relation VARCHAR(100), -- Specific relationship like "3rd cousin", "potential uncle"
    
    -- Match Factors
    matching_factors JSONB DEFAULT '{}', -- What contributed to the match
    location_factor INTEGER DEFAULT 0,
    name_factor INTEGER DEFAULT 0,
    family_tree_factor INTEGER DEFAULT 0,
    dna_factor INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'connected', 'dismissed', 'hidden')),
    viewed BOOLEAN DEFAULT false,
    contacted BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, matched_user_id, match_type)
);

-- User blocks table
CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Block Details
    reason VARCHAR(100),
    notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(blocker_id, blocked_id)
);

-- User reports table
CREATE TABLE IF NOT EXISTS public.user_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Report Details
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    
    -- Admin Notes
    admin_notes TEXT,
    reviewed_by UUID REFERENCES public.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Media files table (for photo/video uploads)
CREATE TABLE IF NOT EXISTS public.media_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploader_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- File Details
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    file_type VARCHAR(20) CHECK (file_type IN ('image', 'video', 'audio', 'document')),
    mime_type VARCHAR(100),
    file_size BIGINT,
    file_url TEXT NOT NULL,
    
    -- Media Metadata
    duration INTEGER, -- for audio/video
    dimensions JSONB, -- {"width": 1920, "height": 1080}
    
    -- Usage Context
    usage_context VARCHAR(50), -- 'profile', 'message', 'community', etc.
    reference_id UUID, -- ID of the related entity (conversation, etc.)
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_processed BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Friend requests indexes
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_created ON public.friend_requests(created_at DESC);

-- Connections indexes
CREATE INDEX IF NOT EXISTS idx_connections_user1 ON public.connections(user1_id, status);
CREATE INDEX IF NOT EXISTS idx_connections_user2 ON public.connections(user2_id, status);
CREATE INDEX IF NOT EXISTS idx_connections_type ON public.connections(connection_type, status);

-- Matches indexes
CREATE INDEX IF NOT EXISTS idx_matches_user ON public.matches(user_id, match_type, status);
CREATE INDEX IF NOT EXISTS idx_matches_matched_user ON public.matches(matched_user_id, match_type);
CREATE INDEX IF NOT EXISTS idx_matches_score ON public.matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_created ON public.matches(created_at DESC);

-- User blocks indexes
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

-- Media files indexes
CREATE INDEX IF NOT EXISTS idx_media_files_uploader ON public.media_files(uploader_id, is_active);
CREATE INDEX IF NOT EXISTS idx_media_files_context ON public.media_files(usage_context, reference_id);
CREATE INDEX IF NOT EXISTS idx_media_files_type ON public.media_files(file_type, is_active);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Create or replace function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_friend_requests_updated_at ON public.friend_requests;
CREATE TRIGGER update_friend_requests_updated_at
    BEFORE UPDATE ON public.friend_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_connections_updated_at ON public.connections;
CREATE TRIGGER update_connections_updated_at
    BEFORE UPDATE ON public.connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_matches_updated_at ON public.matches;
CREATE TRIGGER update_matches_updated_at
    BEFORE UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_reports_updated_at ON public.user_reports;
CREATE TRIGGER update_user_reports_updated_at
    BEFORE UPDATE ON public.user_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_media_files_updated_at ON public.media_files;
CREATE TRIGGER update_media_files_updated_at
    BEFORE UPDATE ON public.media_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT ALL ON public.friend_requests TO anon, authenticated;
GRANT ALL ON public.connections TO anon, authenticated;
GRANT ALL ON public.matches TO anon, authenticated;
GRANT ALL ON public.user_blocks TO anon, authenticated;
GRANT ALL ON public.user_reports TO anon, authenticated;
GRANT ALL ON public.media_files TO anon, authenticated;

-- ============================================
-- ROW LEVEL SECURITY (Disabled for development)
-- ============================================

ALTER TABLE public.friend_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files DISABLE ROW LEVEL SECURITY;

-- Success message
SELECT 'Connection tables created successfully!' AS result;