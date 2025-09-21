-- ============================================================================
-- Auth Service - API Keys Table Migration
-- ============================================================================
-- Version: 1.8.0
-- Description: Create api_keys table for API key management
-- Service: auth-service
-- Author: Capsule Platform Team
-- Dependencies: V1.1.0__Create_users_table.sql
-- ============================================================================
--
-- This migration creates the api_keys table with:
-- - API key generation and management
-- - Scope-based permissions and rate limiting
-- - Usage tracking and expiration management
-- - Key revocation and audit capabilities
--
-- ============================================================================

-- Create api_keys table based on ApiKeySchema
CREATE TABLE api_keys (
    -- Base entity fields
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- API key fields
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]'::JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    last_used_at TIMESTAMP WITH TIME ZONE NULL,
    usage_count BIGINT NOT NULL DEFAULT 0,
    rate_limit_per_hour INTEGER NULL,

    -- Constraints
    CONSTRAINT api_keys_name_not_empty CHECK (char_length(name) > 0),
    CONSTRAINT api_keys_key_hash_not_empty CHECK (char_length(key_hash) > 0),
    CONSTRAINT api_keys_key_prefix_not_empty CHECK (char_length(key_prefix) > 0),
    CONSTRAINT api_keys_usage_count_non_negative CHECK (usage_count >= 0),
    CONSTRAINT api_keys_rate_limit_positive CHECK (rate_limit_per_hour IS NULL OR rate_limit_per_hour > 0),
    CONSTRAINT api_keys_expires_in_future CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT api_keys_last_used_valid CHECK (last_used_at IS NULL OR last_used_at >= created_at),

    -- Foreign key constraints
    CONSTRAINT fk_api_keys_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE UNIQUE INDEX idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys (key_prefix);
CREATE INDEX idx_api_keys_is_active ON api_keys (is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_api_keys_last_used_at ON api_keys (last_used_at) WHERE last_used_at IS NOT NULL;
CREATE INDEX idx_api_keys_scopes ON api_keys USING GIN (scopes);

-- Composite indexes for common queries
CREATE INDEX idx_api_keys_user_active ON api_keys (user_id, is_active)
    WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);
CREATE INDEX idx_api_keys_active_lookup ON api_keys (key_prefix, key_hash)
    WHERE is_active = TRUE AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

-- Unique constraint to prevent duplicate active key names per user
CREATE UNIQUE INDEX idx_api_keys_unique_name_per_user
    ON api_keys (user_id, name)
    WHERE is_active = TRUE;

-- Create trigger for updated_at
CREATE TRIGGER api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Create function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key(
    target_user_id UUID,
    key_name VARCHAR(100),
    key_scopes JSONB DEFAULT '[]'::JSONB,
    expiry_days INTEGER DEFAULT NULL,
    hourly_rate_limit INTEGER DEFAULT NULL
) RETURNS TABLE (
    api_key_id UUID,
    api_key VARCHAR(64),
    key_prefix VARCHAR(10),
    expires_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    new_key VARCHAR(64);
    new_prefix VARCHAR(10);
    key_hash VARCHAR(255);
    new_key_id UUID;
    new_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Generate API key components
    new_prefix := 'ck_' || substr(encode(gen_random_bytes(4), 'hex'), 1, 6);
    new_key := new_prefix || '_' || encode(gen_random_bytes(32), 'hex');

    -- Hash the key for storage (in production, use a proper password hashing function)
    key_hash := encode(digest(new_key, 'sha256'), 'hex');

    -- Set expiration if specified
    IF expiry_days IS NOT NULL THEN
        new_expires_at := CURRENT_TIMESTAMP + (expiry_days || ' days')::INTERVAL;
    END IF;

    -- Validate scopes format
    IF NOT jsonb_typeof(key_scopes) = 'array' THEN
        RAISE EXCEPTION 'Scopes must be a JSON array';
    END IF;

    -- Insert new API key
    INSERT INTO api_keys (
        user_id,
        name,
        key_hash,
        key_prefix,
        scopes,
        expires_at,
        rate_limit_per_hour
    ) VALUES (
        target_user_id,
        key_name,
        key_hash,
        new_prefix,
        key_scopes,
        new_expires_at,
        hourly_rate_limit
    ) RETURNING id INTO new_key_id;

    RETURN QUERY SELECT new_key_id, new_key, new_prefix, new_expires_at;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate API key
CREATE OR REPLACE FUNCTION validate_api_key(
    provided_key VARCHAR(64)
) RETURNS TABLE (
    key_id UUID,
    user_id UUID,
    scopes JSONB,
    rate_limit_per_hour INTEGER,
    is_valid BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    key_prefix VARCHAR(10);
    key_hash VARCHAR(255);
    key_record RECORD;
BEGIN
    -- Extract prefix from provided key
    key_prefix := split_part(provided_key, '_', 1) || '_' || split_part(provided_key, '_', 2);

    -- Hash the provided key
    key_hash := encode(digest(provided_key, 'sha256'), 'hex');

    -- Find the API key
    SELECT ak.*, u.is_active as user_active, u.deleted_at
    INTO key_record
    FROM api_keys ak
    JOIN users u ON ak.user_id = u.id
    WHERE ak.key_hash = key_hash
    AND ak.key_prefix = key_prefix;

    -- Check if key exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::JSONB, NULL::INTEGER, FALSE, 'Invalid API key'::TEXT;
        RETURN;
    END IF;

    -- Check if user is active
    IF NOT key_record.user_active OR key_record.deleted_at IS NOT NULL THEN
        RETURN QUERY SELECT key_record.id, key_record.user_id, key_record.scopes,
                           key_record.rate_limit_per_hour, FALSE, 'User account is inactive'::TEXT;
        RETURN;
    END IF;

    -- Check if key is active
    IF NOT key_record.is_active THEN
        RETURN QUERY SELECT key_record.id, key_record.user_id, key_record.scopes,
                           key_record.rate_limit_per_hour, FALSE, 'API key is inactive'::TEXT;
        RETURN;
    END IF;

    -- Check if key is expired
    IF key_record.expires_at IS NOT NULL AND key_record.expires_at <= CURRENT_TIMESTAMP THEN
        RETURN QUERY SELECT key_record.id, key_record.user_id, key_record.scopes,
                           key_record.rate_limit_per_hour, FALSE, 'API key has expired'::TEXT;
        RETURN;
    END IF;

    -- Update usage statistics
    UPDATE api_keys
    SET
        last_used_at = CURRENT_TIMESTAMP,
        usage_count = usage_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = key_record.id;

    -- Return valid key information
    RETURN QUERY SELECT key_record.id, key_record.user_id, key_record.scopes,
                       key_record.rate_limit_per_hour, TRUE, 'Valid API key'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create function to revoke API key
CREATE OR REPLACE FUNCTION revoke_api_key(
    target_user_id UUID,
    key_id_or_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER;
    key_uuid UUID;
BEGIN
    -- Try to parse as UUID first, otherwise treat as name
    BEGIN
        key_uuid := key_id_or_name::UUID;

        UPDATE api_keys
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE id = key_uuid AND user_id = target_user_id AND is_active = TRUE;

    EXCEPTION WHEN invalid_text_representation THEN
        -- Not a UUID, treat as key name
        UPDATE api_keys
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE name = key_id_or_name AND user_id = target_user_id AND is_active = TRUE;
    END;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's API keys
CREATE OR REPLACE FUNCTION get_user_api_keys(target_user_id UUID)
RETURNS TABLE (
    key_id UUID,
    name VARCHAR(100),
    key_prefix VARCHAR(10),
    scopes JSONB,
    is_active BOOLEAN,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count BIGINT,
    rate_limit_per_hour INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ak.id as key_id,
        ak.name,
        ak.key_prefix,
        ak.scopes,
        ak.is_active,
        ak.expires_at,
        ak.last_used_at,
        ak.usage_count,
        ak.rate_limit_per_hour,
        ak.created_at
    FROM api_keys ak
    WHERE ak.user_id = target_user_id
    ORDER BY ak.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function for API key cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_api_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Mark expired keys as inactive
    UPDATE api_keys
    SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
    WHERE expires_at < CURRENT_TIMESTAMP
    AND is_active = TRUE;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Deactivated % expired API keys', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for API key usage statistics
CREATE VIEW api_key_usage_stats AS
SELECT
    DATE_TRUNC('day', last_used_at) as usage_date,
    COUNT(*) as keys_used,
    COUNT(DISTINCT user_id) as unique_users,
    SUM(usage_count) as total_requests,
    AVG(usage_count) as avg_requests_per_key
FROM api_keys
WHERE last_used_at >= CURRENT_DATE - INTERVAL '30 days'
AND last_used_at IS NOT NULL
GROUP BY DATE_TRUNC('day', last_used_at)
ORDER BY usage_date DESC;

-- Add table comment
COMMENT ON TABLE api_keys IS 'API keys for programmatic access to the platform';

-- Add column comments
COMMENT ON COLUMN api_keys.id IS 'Unique identifier for the API key';
COMMENT ON COLUMN api_keys.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN api_keys.name IS 'Human-readable name for the API key';
COMMENT ON COLUMN api_keys.key_hash IS 'Hashed version of the API key for secure storage';
COMMENT ON COLUMN api_keys.key_prefix IS 'Public prefix of the API key for identification';
COMMENT ON COLUMN api_keys.scopes IS 'JSON array of permissions/scopes for this key';
COMMENT ON COLUMN api_keys.is_active IS 'Whether the API key is currently active';
COMMENT ON COLUMN api_keys.expires_at IS 'Optional expiration timestamp for the key';
COMMENT ON COLUMN api_keys.last_used_at IS 'Timestamp of last API key usage';
COMMENT ON COLUMN api_keys.usage_count IS 'Total number of times this key has been used';
COMMENT ON COLUMN api_keys.rate_limit_per_hour IS 'Optional rate limit for this key (requests per hour)';

-- Add function comments
COMMENT ON FUNCTION generate_api_key(UUID, VARCHAR, JSONB, INTEGER, INTEGER) IS 'Generates a new API key for a user with optional expiration and rate limiting';
COMMENT ON FUNCTION validate_api_key(VARCHAR) IS 'Validates an API key and returns user information and permissions';
COMMENT ON FUNCTION revoke_api_key(UUID, TEXT) IS 'Revokes an API key by ID or name for a specific user';
COMMENT ON FUNCTION get_user_api_keys(UUID) IS 'Returns all API keys for a specific user';
COMMENT ON FUNCTION cleanup_expired_api_keys() IS 'Deactivates expired API keys';

-- Verify table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'api_keys' AND table_schema = current_schema()
    ) THEN
        RAISE EXCEPTION 'API keys table creation failed';
    END IF;

    RAISE NOTICE 'API keys table created successfully with % indexes',
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'api_keys');
END $$;