-- =====================================================
-- SFH Bot - Supabase Database Setup
-- =====================================================
-- This file sets up the complete database schema for the SFH Bot project
-- Run this in your Supabase SQL Editor

-- Enable required extensions
-- =====================================================

-- Enable vector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension for generating unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for additional encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing tables if they exist (for clean setup)
-- =====================================================
DROP TABLE IF EXISTS knowledge_documents CASCADE;
DROP TABLE IF EXISTS chat_logs CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP FUNCTION IF EXISTS search_knowledge_documents CASCADE;
DROP FUNCTION IF EXISTS get_chat_analytics CASCADE;

-- Create main tables
-- =====================================================

-- Knowledge base table for organizational information
CREATE TABLE knowledge_documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    metadata JSONB DEFAULT '{}',
    embedding VECTOR(1536), -- OpenAI text-embedding-ada-002 dimensions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
    source TEXT DEFAULT 'manual', -- 'manual', 'import', 'api'
    tags TEXT[] DEFAULT '{}',
    version INTEGER DEFAULT 1
);

-- Chat logs table for conversation history and analytics
CREATE TABLE chat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    session_id TEXT,
    message TEXT NOT NULL,
    reply TEXT NOT NULL,
    response_time_ms INTEGER,
    model_used TEXT DEFAULT 'gpt-4',
    knowledge_sources INTEGER[] DEFAULT '{}', -- References to knowledge_documents.id
    mem0_memories_used BOOLEAN DEFAULT FALSE,
    user_feedback INTEGER, -- 1=thumbs down, 2=neutral, 3=thumbs up
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    error_occurred BOOLEAN DEFAULT FALSE,
    error_message TEXT
);

-- User sessions table for tracking anonymous users and preferences
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL UNIQUE,
    session_data JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    total_messages INTEGER DEFAULT 0,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    user_type TEXT DEFAULT 'anonymous', -- 'anonymous', 'registered', 'staff'
    notes TEXT
);

-- Create indexes for performance
-- =====================================================

-- Vector similarity search index
CREATE INDEX ON knowledge_documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Chat logs indexes
CREATE INDEX idx_chat_logs_user_id ON chat_logs(user_id);
CREATE INDEX idx_chat_logs_created_at ON chat_logs(created_at);
CREATE INDEX idx_chat_logs_session_id ON chat_logs(session_id);
CREATE INDEX idx_chat_logs_feedback ON chat_logs(user_feedback) WHERE user_feedback IS NOT NULL;

-- Knowledge documents indexes
CREATE INDEX idx_knowledge_category ON knowledge_documents(category);
CREATE INDEX idx_knowledge_active ON knowledge_documents(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_knowledge_priority ON knowledge_documents(priority);
CREATE INDEX idx_knowledge_tags ON knowledge_documents USING GIN(tags);
CREATE INDEX idx_knowledge_metadata ON knowledge_documents USING GIN(metadata);

-- User sessions indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_last_seen ON user_sessions(last_seen);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = TRUE;

-- Create functions for vector search and analytics
-- =====================================================

-- Function for semantic search of knowledge documents
CREATE OR REPLACE FUNCTION search_knowledge_documents(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 3,
    category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id INT,
    title TEXT,
    content TEXT,
    category TEXT,
    metadata JSONB,
    similarity FLOAT,
    priority INT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        kd.id,
        kd.title,
        kd.content,
        kd.category,
        kd.metadata,
        1 - (kd.embedding <=> query_embedding) AS similarity,
        kd.priority
    FROM knowledge_documents kd
    WHERE kd.is_active = TRUE
        AND (category_filter IS NULL OR kd.category = category_filter)
        AND 1 - (kd.embedding <=> query_embedding) > match_threshold
    ORDER BY kd.priority DESC, similarity DESC
    LIMIT match_count;
$$;

-- Function for chat analytics
CREATE OR REPLACE FUNCTION get_chat_analytics(
    start_date TIMESTAMP DEFAULT NOW() - INTERVAL '7 days',
    end_date TIMESTAMP DEFAULT NOW()
)
RETURNS TABLE (
    total_conversations BIGINT,
    unique_users BIGINT,
    avg_response_time FLOAT,
    positive_feedback BIGINT,
    negative_feedback BIGINT,
    error_rate FLOAT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        COUNT(*) as total_conversations,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(response_time_ms)::FLOAT as avg_response_time,
        COUNT(*) FILTER (WHERE user_feedback = 3) as positive_feedback,
        COUNT(*) FILTER (WHERE user_feedback = 1) as negative_feedback,
        (COUNT(*) FILTER (WHERE error_occurred = TRUE)::FLOAT / COUNT(*) * 100) as error_rate
    FROM chat_logs
    WHERE created_at BETWEEN start_date AND end_date;
$$;

-- Function to update user session activity
CREATE OR REPLACE FUNCTION update_user_session(
    p_user_id TEXT,
    p_session_data JSONB DEFAULT NULL,
    p_preferences JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO user_sessions (user_id, session_data, preferences, total_messages, last_seen)
    VALUES (p_user_id, p_session_data, p_preferences, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        session_data = CASE WHEN p_session_data IS NOT NULL THEN p_session_data ELSE user_sessions.session_data END,
        preferences = CASE WHEN p_preferences IS NOT NULL THEN p_preferences ELSE user_sessions.preferences END,
        total_messages = user_sessions.total_messages + 1,
        last_seen = NOW(),
        is_active = TRUE;
END;
$$;

-- Function to clean up old data (for privacy compliance)
CREATE OR REPLACE FUNCTION cleanup_old_data(
    retention_days INT DEFAULT 90
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INT;
BEGIN
    -- Delete old chat logs
    DELETE FROM chat_logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Mark inactive user sessions
    UPDATE user_sessions 
    SET is_active = FALSE 
    WHERE last_seen < NOW() - INTERVAL '1 day' * retention_days;
    
    RETURN deleted_count;
END;
$$;

-- Create Row Level Security (RLS) policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Knowledge documents - publicly readable
CREATE POLICY "Knowledge documents are publicly readable" ON knowledge_documents
    FOR SELECT USING (is_active = TRUE);

-- Allow service role to manage knowledge documents
CREATE POLICY "Service role can manage knowledge documents" ON knowledge_documents
    USING (auth.role() = 'service_role');

-- Chat logs - users can only see their own
CREATE POLICY "Users can view own chat logs" ON chat_logs
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE));

-- Service role can access all chat logs
CREATE POLICY "Service role can access all chat logs" ON chat_logs
    USING (auth.role() = 'service_role');

-- User sessions - users can only see their own
CREATE POLICY "Users can view own session" ON user_sessions
    FOR SELECT USING (user_id = current_setting('app.current_user_id', TRUE));

CREATE POLICY "Service role can manage user sessions" ON user_sessions
    USING (auth.role() = 'service_role');

-- Create triggers for automatic timestamp updates
-- =====================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for knowledge_documents
CREATE TRIGGER update_knowledge_documents_updated_at 
    BEFORE UPDATE ON knowledge_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial knowledge base data
-- =====================================================

-- Note: Embeddings will be generated by the application
INSERT INTO knowledge_documents (title, content, category, priority, tags) VALUES
(
    'About Our Organization',
    'We are a community-focused non-profit organization dedicated to making a positive impact in our local area. We focus on education, community support, and social services. Our mission is to empower individuals and strengthen communities through collaborative programs and initiatives.',
    'general',
    3,
    ARRAY['about', 'mission', 'general']
),
(
    'How to Donate',
    'Donations can be made online through our secure website, by phone during business hours (Monday-Friday 9am-5pm), or by mailing a check to our office address. We accept one-time and recurring donations of any amount. All donations are tax-deductible and you will receive an official receipt within 24 hours. We also accept donations of goods, vehicles, and securities.',
    'donations',
    3,
    ARRAY['donate', 'funding', 'tax-deductible']
),
(
    'Volunteer Opportunities',
    'We welcome volunteers of all ages and backgrounds! Current opportunities include: community outreach, event planning, administrative support, tutoring and mentorship, food distribution, and fundraising assistance. To get started, complete our online volunteer application, attend a brief orientation session, and complete any required training. We offer flexible scheduling and will match you with opportunities that fit your interests and availability.',
    'volunteering',
    3,
    ARRAY['volunteer', 'help', 'community service']
),
(
    'Upcoming Events',
    'We regularly host community events throughout the year. Monthly events include food drives (first Saturday of each month), educational workshops (second Wednesday), and community meetings (third Thursday). Quarterly events feature our signature fundraising gala, volunteer appreciation dinner, and community health fair. Special events are announced on our website and social media channels.',
    'events',
    2,
    ARRAY['events', 'calendar', 'community']
),
(
    'Contact Information',
    'Our main office is open Monday through Friday, 9am to 5pm. You can reach us by phone at our main number, email us at info@ourorganization.org, or visit us in person at our downtown location. We also have satellite offices in the north and south districts. For urgent matters outside business hours, please use our emergency contact line. We respond to all inquiries within one business day.',
    'contact',
    3,
    ARRAY['contact', 'hours', 'location']
),
(
    'Programs and Services',
    'We offer several core programs: Youth Development Program (after-school tutoring and mentorship), Senior Support Services (wellness checks and transportation), Food Security Initiative (weekly food distribution), Educational Scholarships (annual awards for local students), and Community Health Services (free health screenings and wellness workshops). Each program has specific eligibility requirements and application processes.',
    'programs',
    2,
    ARRAY['programs', 'services', 'community']
),
(
    'Financial Transparency',
    'We are committed to complete financial transparency. Our annual reports, including detailed breakdowns of program expenses, administrative costs, and fundraising expenses, are publicly available on our website. We maintain a four-star rating with charity watchdog organizations and ensure that over 85% of donations go directly to program services. Financial audits are conducted annually by independent certified public accountants.',
    'transparency',
    2,
    ARRAY['finances', 'transparency', 'accountability']
),
(
    'Privacy Policy',
    'We respect your privacy and are committed to protecting your personal information. We collect only the information necessary to provide our services and communicate with you about our programs. Your personal information is never sold, shared, or used for purposes other than those explicitly stated. You may request to see, update, or delete your personal information at any time by contacting our privacy officer.',
    'privacy',
    1,
    ARRAY['privacy', 'data protection', 'rights']
);

-- Create a view for active knowledge with search functionality
-- =====================================================

CREATE OR REPLACE VIEW active_knowledge AS
SELECT 
    id,
    title,
    content,
    category,
    priority,
    tags,
    created_at,
    updated_at
FROM knowledge_documents 
WHERE is_active = TRUE
ORDER BY priority DESC, updated_at DESC;

-- Create a view for chat analytics dashboard
-- =====================================================

CREATE OR REPLACE VIEW chat_analytics_today AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_messages,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(response_time_ms) as avg_response_time,
    COUNT(*) FILTER (WHERE user_feedback = 3) as positive_feedback,
    COUNT(*) FILTER (WHERE user_feedback = 1) as negative_feedback,
    COUNT(*) FILTER (WHERE error_occurred = TRUE) as errors
FROM chat_logs 
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY DATE(created_at);

-- Grant necessary permissions
-- =====================================================

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions on tables
GRANT SELECT ON knowledge_documents TO anon;
GRANT SELECT ON knowledge_documents TO authenticated;

GRANT INSERT, SELECT, UPDATE ON chat_logs TO anon;
GRANT INSERT, SELECT, UPDATE ON chat_logs TO authenticated;

GRANT INSERT, SELECT, UPDATE ON user_sessions TO anon;
GRANT INSERT, SELECT, UPDATE ON user_sessions TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION search_knowledge_documents TO anon;
GRANT EXECUTE ON FUNCTION search_knowledge_documents TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_session TO anon;
GRANT EXECUTE ON FUNCTION update_user_session TO authenticated;

-- Final setup notes
-- =====================================================

-- Create a setup completion log
CREATE TABLE IF NOT EXISTS setup_log (
    id SERIAL PRIMARY KEY,
    setup_completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version TEXT DEFAULT '1.0.0',
    notes TEXT
);

INSERT INTO setup_log (notes) VALUES ('Initial SFH Bot database setup completed successfully');

-- Display setup summary
SELECT 
    'Setup completed successfully!' as status,
    COUNT(*) as knowledge_documents_created
FROM knowledge_documents;

-- Show what was created - using standard SQL instead of psql commands
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('knowledge_documents', 'chat_logs', 'user_sessions')
    AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Show available functions
SELECT 
    routine_name as function_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_name IN ('search_knowledge_documents', 'get_chat_analytics', 'update_user_session', 'cleanup_old_data')
    AND routine_schema = 'public';

-- Final status
SELECT 'Database setup completed! Ready for SFH Bot deployment.' as message;