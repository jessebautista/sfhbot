-- =====================================================
-- SFH Bot - RLS Policy Fix for Anonymous Chat Access
-- =====================================================
-- This file fixes the RLS policies to allow anonymous chatbot access
-- Run this in your Supabase SQL Editor AFTER running supabase_setup.sql

-- Option 1: Allow anonymous access for chatbot functionality
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own chat logs" ON chat_logs;
DROP POLICY IF EXISTS "Users can view own session" ON user_sessions;
DROP POLICY IF EXISTS "Service role can access all chat logs" ON chat_logs;
DROP POLICY IF EXISTS "Service role can manage user sessions" ON user_sessions;

-- Create new policies that allow anonymous access for chatbot
-- Chat logs - allow anonymous inserts and service role access
CREATE POLICY "Allow anonymous chat logging" ON chat_logs
    FOR INSERT TO anon 
    WITH CHECK (true);

CREATE POLICY "Service role full access to chat logs" ON chat_logs
    TO service_role
    USING (true)
    WITH CHECK (true);

-- User sessions - allow anonymous access and service role access  
CREATE POLICY "Allow anonymous user sessions" ON user_sessions
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access to user sessions" ON user_sessions
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant necessary permissions to anonymous role
GRANT INSERT, SELECT, UPDATE ON chat_logs TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON user_sessions TO anon;

-- Grant full access to service role
GRANT ALL ON chat_logs TO service_role;
GRANT ALL ON user_sessions TO service_role;

-- Grant usage on sequences (needed for inserts)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Verify policies are working
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('chat_logs', 'user_sessions')
ORDER BY tablename, policyname;