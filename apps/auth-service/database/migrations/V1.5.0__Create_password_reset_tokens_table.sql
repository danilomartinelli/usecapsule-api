-- ============================================================================
-- Auth Service - Password Reset Tokens Table Migration
-- ============================================================================
-- Version: 1.5.0
-- Description: Create password_reset_tokens table for password reset functionality
-- Service: auth-service
-- Author: Capsule Platform Team
-- Dependencies: V1.1.0__Create_users_table.sql
-- ============================================================================
--
-- This migration creates the password_reset_tokens table with:
-- - Password reset token management
-- - Token expiration and usage tracking
-- - Security constraints and cleanup functions
-- - Single-use token enforcement
--
-- ============================================================================

-- Create password_reset_tokens table based on PasswordResetTokenSchema
CREATE TABLE password_reset_tokens (
    -- Base entity fields
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Password reset token fields
    user_id UUID NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE NULL,

    -- Constraints
    CONSTRAINT password_reset_tokens_token_not_empty
        CHECK (char_length(token) > 0),
    CONSTRAINT password_reset_tokens_expires_in_future
        CHECK (expires_at > created_at),
    CONSTRAINT password_reset_tokens_used_after_created
        CHECK (used_at IS NULL OR used_at >= created_at),

    -- Foreign key constraints
    CONSTRAINT fk_password_reset_tokens_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE UNIQUE INDEX idx_password_reset_tokens_token ON password_reset_tokens (token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);
CREATE INDEX idx_password_reset_tokens_used_at ON password_reset_tokens (used_at) WHERE used_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_password_reset_tokens_valid ON password_reset_tokens (user_id, token)
    WHERE used_at IS NULL AND expires_at > CURRENT_TIMESTAMP;
CREATE INDEX idx_password_reset_tokens_cleanup ON password_reset_tokens (expires_at, used_at)
    WHERE expires_at < CURRENT_TIMESTAMP OR used_at IS NOT NULL;

-- Unique constraint to prevent multiple unused tokens for same user
CREATE UNIQUE INDEX idx_password_reset_tokens_active_unique
    ON password_reset_tokens (user_id)
    WHERE used_at IS NULL AND expires_at > CURRENT_TIMESTAMP;

-- Create trigger for updated_at
CREATE TRIGGER password_reset_tokens_updated_at
    BEFORE UPDATE ON password_reset_tokens
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Create function to validate token usage
CREATE OR REPLACE FUNCTION use_password_reset_token(
    token_value VARCHAR(255)
) RETURNS TABLE (
    success BOOLEAN,
    user_id UUID,
    message TEXT
) AS $$
DECLARE
    token_record RECORD;
BEGIN
    -- Find the token
    SELECT t.*, u.email
    INTO token_record
    FROM password_reset_tokens t
    JOIN users u ON t.user_id = u.id
    WHERE t.token = token_value
    AND u.deleted_at IS NULL;

    -- Check if token exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Invalid password reset token'::TEXT;
        RETURN;
    END IF;

    -- Check if token is already used
    IF token_record.used_at IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, token_record.user_id, 'Token has already been used'::TEXT;
        RETURN;
    END IF;

    -- Check if token is expired
    IF token_record.expires_at <= CURRENT_TIMESTAMP THEN
        RETURN QUERY SELECT FALSE, token_record.user_id, 'Token has expired'::TEXT;
        RETURN;
    END IF;

    -- Mark token as used
    UPDATE password_reset_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE token = token_value;

    RETURN QUERY SELECT TRUE, token_record.user_id, 'Token validated successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create function for token cleanup
CREATE OR REPLACE FUNCTION cleanup_password_reset_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired or used tokens older than 7 days
    DELETE FROM password_reset_tokens
    WHERE expires_at < CURRENT_TIMESTAMP
    OR (used_at IS NOT NULL AND used_at < CURRENT_TIMESTAMP - INTERVAL '7 days');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Cleaned up % password reset tokens', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate new password reset token
CREATE OR REPLACE FUNCTION create_password_reset_token(
    target_user_id UUID,
    expiry_hours INTEGER DEFAULT 1
) RETURNS TABLE (
    token_id UUID,
    token_value VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    new_token VARCHAR(255);
    new_token_id UUID;
    new_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Generate secure token (in production, this should be more cryptographically secure)
    new_token := encode(gen_random_bytes(32), 'base64');
    new_token := replace(replace(replace(new_token, '+', '-'), '/', '_'), '=', '');
    new_expires_at := CURRENT_TIMESTAMP + (expiry_hours || ' hours')::INTERVAL;

    -- Invalidate any existing unused tokens for this user
    UPDATE password_reset_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE user_id = target_user_id
    AND used_at IS NULL
    AND expires_at > CURRENT_TIMESTAMP;

    -- Insert new token
    INSERT INTO password_reset_tokens (user_id, token, expires_at)
    VALUES (target_user_id, new_token, new_expires_at)
    RETURNING id INTO new_token_id;

    RETURN QUERY SELECT new_token_id, new_token, new_expires_at;
END;
$$ LANGUAGE plpgsql;

-- Create view for token statistics
CREATE VIEW password_reset_token_stats AS
SELECT
    DATE_TRUNC('day', created_at) as token_date,
    COUNT(*) as total_tokens,
    COUNT(used_at) as used_tokens,
    COUNT(*) - COUNT(used_at) as unused_tokens,
    COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP AND used_at IS NULL THEN 1 END) as expired_tokens,
    AVG(EXTRACT(EPOCH FROM (COALESCE(used_at, CURRENT_TIMESTAMP) - created_at))) as avg_usage_time_seconds
FROM password_reset_tokens
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY token_date DESC;

-- Add table comment
COMMENT ON TABLE password_reset_tokens IS 'Password reset tokens for secure password recovery';

-- Add column comments
COMMENT ON COLUMN password_reset_tokens.id IS 'Unique identifier for the password reset token';
COMMENT ON COLUMN password_reset_tokens.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN password_reset_tokens.token IS 'Unique password reset token string';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp when token was used (NULL if unused)';

-- Add function comments
COMMENT ON FUNCTION use_password_reset_token(VARCHAR) IS 'Validates and uses a password reset token';
COMMENT ON FUNCTION cleanup_password_reset_tokens() IS 'Removes expired and old used password reset tokens';
COMMENT ON FUNCTION create_password_reset_token(UUID, INTEGER) IS 'Creates a new password reset token for a user';

-- Verify table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'password_reset_tokens' AND table_schema = current_schema()
    ) THEN
        RAISE EXCEPTION 'Password reset tokens table creation failed';
    END IF;

    RAISE NOTICE 'Password reset tokens table created successfully with % indexes',
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'password_reset_tokens');
END $$;