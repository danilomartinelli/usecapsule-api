-- ============================================================================
-- Auth Service - Email Verification Tokens Table Migration
-- ============================================================================
-- Version: 1.4.0
-- Description: Create email_verification_tokens table for email verification
-- Service: auth-service
-- Author: Capsule Platform Team
-- Dependencies: V1.1.0__Create_users_table.sql
-- ============================================================================
--
-- This migration creates the email_verification_tokens table with:
-- - Email verification token management
-- - Token expiration and usage tracking
-- - Support for email address changes
-- - Security constraints and cleanup functions
--
-- ============================================================================

-- Create email_verification_tokens table based on EmailVerificationTokenSchema
CREATE TABLE email_verification_tokens (
    -- Base entity fields
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Verification token fields
    user_id UUID NOT NULL,
    token VARCHAR(255) NOT NULL,
    email CITEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE NULL,

    -- Constraints
    CONSTRAINT email_verification_tokens_token_not_empty
        CHECK (char_length(token) > 0),
    CONSTRAINT email_verification_tokens_email_valid
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT email_verification_tokens_expires_in_future
        CHECK (expires_at > created_at),
    CONSTRAINT email_verification_tokens_used_after_created
        CHECK (used_at IS NULL OR used_at >= created_at),

    -- Foreign key constraints
    CONSTRAINT fk_email_verification_tokens_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE UNIQUE INDEX idx_email_verification_tokens_token ON email_verification_tokens (token);
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens (user_id);
CREATE INDEX idx_email_verification_tokens_email ON email_verification_tokens (email);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens (expires_at);
CREATE INDEX idx_email_verification_tokens_used_at ON email_verification_tokens (used_at) WHERE used_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_email_verification_tokens_valid ON email_verification_tokens (user_id, token)
    WHERE used_at IS NULL AND expires_at > CURRENT_TIMESTAMP;
CREATE INDEX idx_email_verification_tokens_cleanup ON email_verification_tokens (expires_at, used_at)
    WHERE expires_at < CURRENT_TIMESTAMP OR used_at IS NOT NULL;

-- Unique constraint to prevent multiple unused tokens for same user/email
CREATE UNIQUE INDEX idx_email_verification_tokens_active_unique
    ON email_verification_tokens (user_id, email)
    WHERE used_at IS NULL AND expires_at > CURRENT_TIMESTAMP;

-- Create trigger for updated_at
CREATE TRIGGER email_verification_tokens_updated_at
    BEFORE UPDATE ON email_verification_tokens
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Create function to validate token usage
CREATE OR REPLACE FUNCTION use_verification_token(
    token_value VARCHAR(255)
) RETURNS TABLE (
    success BOOLEAN,
    user_id UUID,
    email CITEXT,
    message TEXT
) AS $$
DECLARE
    token_record RECORD;
BEGIN
    -- Find the token
    SELECT t.*, u.email as current_email
    INTO token_record
    FROM email_verification_tokens t
    JOIN users u ON t.user_id = u.id
    WHERE t.token = token_value
    AND u.deleted_at IS NULL;

    -- Check if token exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::CITEXT, 'Invalid verification token'::TEXT;
        RETURN;
    END IF;

    -- Check if token is already used
    IF token_record.used_at IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, token_record.user_id, token_record.email, 'Token has already been used'::TEXT;
        RETURN;
    END IF;

    -- Check if token is expired
    IF token_record.expires_at <= CURRENT_TIMESTAMP THEN
        RETURN QUERY SELECT FALSE, token_record.user_id, token_record.email, 'Token has expired'::TEXT;
        RETURN;
    END IF;

    -- Mark token as used
    UPDATE email_verification_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE token = token_value;

    -- Update user email verification status
    UPDATE users
    SET
        email = token_record.email,
        email_verified = TRUE,
        email_verified_at = CURRENT_TIMESTAMP
    WHERE id = token_record.user_id;

    RETURN QUERY SELECT TRUE, token_record.user_id, token_record.email, 'Email verified successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create function for token cleanup
CREATE OR REPLACE FUNCTION cleanup_verification_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired or used tokens older than 7 days
    DELETE FROM email_verification_tokens
    WHERE expires_at < CURRENT_TIMESTAMP
    OR (used_at IS NOT NULL AND used_at < CURRENT_TIMESTAMP - INTERVAL '7 days');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Cleaned up % verification tokens', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate new verification token
CREATE OR REPLACE FUNCTION create_verification_token(
    target_user_id UUID,
    target_email CITEXT,
    expiry_hours INTEGER DEFAULT 24
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

    -- Invalidate any existing unused tokens for this user/email combination
    UPDATE email_verification_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE user_id = target_user_id
    AND email = target_email
    AND used_at IS NULL
    AND expires_at > CURRENT_TIMESTAMP;

    -- Insert new token
    INSERT INTO email_verification_tokens (user_id, token, email, expires_at)
    VALUES (target_user_id, new_token, target_email, new_expires_at)
    RETURNING id INTO new_token_id;

    RETURN QUERY SELECT new_token_id, new_token, new_expires_at;
END;
$$ LANGUAGE plpgsql;

-- Create view for token statistics
CREATE VIEW verification_token_stats AS
SELECT
    DATE_TRUNC('day', created_at) as token_date,
    COUNT(*) as total_tokens,
    COUNT(used_at) as used_tokens,
    COUNT(*) - COUNT(used_at) as unused_tokens,
    COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP AND used_at IS NULL THEN 1 END) as expired_tokens,
    AVG(EXTRACT(EPOCH FROM (COALESCE(used_at, CURRENT_TIMESTAMP) - created_at))) as avg_usage_time_seconds
FROM email_verification_tokens
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY token_date DESC;

-- Add table comment
COMMENT ON TABLE email_verification_tokens IS 'Email verification tokens for confirming user email addresses';

-- Add column comments
COMMENT ON COLUMN email_verification_tokens.id IS 'Unique identifier for the verification token';
COMMENT ON COLUMN email_verification_tokens.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN email_verification_tokens.token IS 'Unique verification token string';
COMMENT ON COLUMN email_verification_tokens.email IS 'Email address to be verified';
COMMENT ON COLUMN email_verification_tokens.expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN email_verification_tokens.used_at IS 'Timestamp when token was used (NULL if unused)';

-- Add function comments
COMMENT ON FUNCTION use_verification_token(VARCHAR) IS 'Validates and uses an email verification token, updating user email verification status';
COMMENT ON FUNCTION cleanup_verification_tokens() IS 'Removes expired and old used verification tokens';
COMMENT ON FUNCTION create_verification_token(UUID, CITEXT, INTEGER) IS 'Creates a new email verification token for a user';

-- Verify table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'email_verification_tokens' AND table_schema = current_schema()
    ) THEN
        RAISE EXCEPTION 'Email verification tokens table creation failed';
    END IF;

    RAISE NOTICE 'Email verification tokens table created successfully with % indexes',
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'email_verification_tokens');
END $$;