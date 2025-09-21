-- ============================================================================
-- Auth Service - Authentication Sessions Table Migration
-- ============================================================================
-- Version: 1.3.0
-- Description: Create auth_sessions table for session management
-- Service: auth-service
-- Author: Capsule Platform Team
-- Dependencies: V1.1.0__Create_users_table.sql
-- ============================================================================
--
-- This migration creates the auth_sessions table with:
-- - Session token management and device tracking
-- - IP address and user agent logging
-- - Session expiration and activity tracking
-- - Multi-device session support
--
-- ============================================================================

-- Create auth_sessions table based on AuthSessionSchema
CREATE TABLE auth_sessions (
    -- Base entity fields
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Session fields
    user_id UUID NOT NULL,
    session_token VARCHAR(255) NOT NULL,
    device_id VARCHAR(255) NULL,
    device_name VARCHAR(255) NULL,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT auth_sessions_session_token_not_empty
        CHECK (char_length(session_token) > 0),
    CONSTRAINT auth_sessions_expires_in_future
        CHECK (expires_at > created_at),
    CONSTRAINT auth_sessions_last_activity_valid
        CHECK (last_activity_at >= created_at),

    -- Foreign key constraints
    CONSTRAINT fk_auth_sessions_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE UNIQUE INDEX idx_auth_sessions_token ON auth_sessions (session_token);
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions (user_id);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions (expires_at);
CREATE INDEX idx_auth_sessions_is_active ON auth_sessions (is_active);
CREATE INDEX idx_auth_sessions_last_activity ON auth_sessions (last_activity_at);
CREATE INDEX idx_auth_sessions_device_id ON auth_sessions (device_id) WHERE device_id IS NOT NULL;
CREATE INDEX idx_auth_sessions_ip_address ON auth_sessions (ip_address);

-- Composite indexes for common queries
CREATE INDEX idx_auth_sessions_user_active ON auth_sessions (user_id, is_active)
    WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP;
CREATE INDEX idx_auth_sessions_cleanup ON auth_sessions (expires_at, is_active)
    WHERE expires_at < CURRENT_TIMESTAMP OR is_active = FALSE;

-- Create trigger for updated_at
CREATE TRIGGER auth_sessions_updated_at
    BEFORE UPDATE ON auth_sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Create function to automatically update last_activity_at on token access
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_activity_at when session is accessed (updated)
    IF TG_OP = 'UPDATE' AND OLD.last_activity_at = NEW.last_activity_at THEN
        NEW.last_activity_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session activity updates
CREATE TRIGGER auth_sessions_activity_update
    BEFORE UPDATE ON auth_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();

-- Create function for session cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired sessions
    DELETE FROM auth_sessions
    WHERE expires_at < CURRENT_TIMESTAMP
    OR (is_active = FALSE AND updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Cleaned up % expired sessions', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get active sessions for a user
CREATE OR REPLACE FUNCTION get_user_active_sessions(target_user_id UUID)
RETURNS TABLE (
    session_id UUID,
    device_name VARCHAR(255),
    device_id VARCHAR(255),
    ip_address INET,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id as session_id,
        s.device_name,
        s.device_id,
        s.ip_address,
        s.last_activity_at,
        s.expires_at,
        s.created_at
    FROM auth_sessions s
    WHERE s.user_id = target_user_id
    AND s.is_active = TRUE
    AND s.expires_at > CURRENT_TIMESTAMP
    ORDER BY s.last_activity_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create view for session analytics
CREATE VIEW session_analytics AS
SELECT
    DATE_TRUNC('day', created_at) as session_date,
    COUNT(*) as total_sessions,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT device_id) as unique_devices,
    COUNT(DISTINCT ip_address) as unique_ips,
    AVG(EXTRACT(EPOCH FROM (expires_at - created_at))) as avg_session_duration_seconds
FROM auth_sessions
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY session_date DESC;

-- Add table comment
COMMENT ON TABLE auth_sessions IS 'Authentication sessions for tracking user login sessions and device information';

-- Add column comments
COMMENT ON COLUMN auth_sessions.id IS 'Unique identifier for the session';
COMMENT ON COLUMN auth_sessions.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN auth_sessions.session_token IS 'Unique session token (should be hashed in production)';
COMMENT ON COLUMN auth_sessions.device_id IS 'Optional device identifier for multi-device tracking';
COMMENT ON COLUMN auth_sessions.device_name IS 'Human-readable device name';
COMMENT ON COLUMN auth_sessions.ip_address IS 'IP address where session was created';
COMMENT ON COLUMN auth_sessions.user_agent IS 'Browser/client user agent string';
COMMENT ON COLUMN auth_sessions.expires_at IS 'Session expiration timestamp';
COMMENT ON COLUMN auth_sessions.is_active IS 'Whether the session is currently active';
COMMENT ON COLUMN auth_sessions.last_activity_at IS 'Timestamp of last session activity';

-- Add function comments
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Removes expired and old inactive sessions from the database';
COMMENT ON FUNCTION get_user_active_sessions(UUID) IS 'Returns all active sessions for a specific user';

-- Verify table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'auth_sessions' AND table_schema = current_schema()
    ) THEN
        RAISE EXCEPTION 'Auth sessions table creation failed';
    END IF;

    RAISE NOTICE 'Auth sessions table created successfully with % indexes',
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'auth_sessions');
END $$;