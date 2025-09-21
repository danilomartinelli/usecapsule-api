-- ============================================================================
-- Auth Service - OAuth Providers Table Migration
-- ============================================================================
-- Version: 1.7.0
-- Description: Create oauth_providers table for OAuth integration
-- Service: auth-service
-- Author: Capsule Platform Team
-- Dependencies: V1.1.0__Create_users_table.sql
-- ============================================================================
--
-- This migration creates the oauth_providers table with:
-- - OAuth provider configuration and credentials
-- - Provider-specific user linking
-- - Profile data synchronization tracking
-- - Account connection management
--
-- ============================================================================

-- Create oauth_providers table based on OAuthProviderSchema
CREATE TABLE oauth_providers (
    -- Base entity fields
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- OAuth provider fields
    user_id UUID NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    access_token TEXT NULL,
    refresh_token TEXT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    profile_data JSONB NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE NULL,

    -- Constraints
    CONSTRAINT oauth_providers_provider_valid
        CHECK (provider IN ('GOOGLE', 'GITHUB', 'FACEBOOK', 'MICROSOFT', 'APPLE')),
    CONSTRAINT oauth_providers_provider_user_id_not_empty
        CHECK (char_length(provider_user_id) > 0),
    CONSTRAINT oauth_providers_expires_in_future
        CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT oauth_providers_last_login_valid
        CHECK (last_login_at IS NULL OR last_login_at >= created_at),

    -- Foreign key constraints
    CONSTRAINT fk_oauth_providers_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_oauth_providers_user_id ON oauth_providers (user_id);
CREATE INDEX idx_oauth_providers_provider ON oauth_providers (provider);
CREATE INDEX idx_oauth_providers_provider_user_id ON oauth_providers (provider_user_id);
CREATE INDEX idx_oauth_providers_is_primary ON oauth_providers (is_primary);
CREATE INDEX idx_oauth_providers_expires_at ON oauth_providers (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_oauth_providers_last_login_at ON oauth_providers (last_login_at) WHERE last_login_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_oauth_providers_user_provider ON oauth_providers (user_id, provider);
CREATE INDEX idx_oauth_providers_provider_lookup ON oauth_providers (provider, provider_user_id);

-- Unique constraints
CREATE UNIQUE INDEX idx_oauth_providers_unique_provider_user
    ON oauth_providers (provider, provider_user_id);

-- Unique constraint to ensure only one primary provider per user per provider type
CREATE UNIQUE INDEX idx_oauth_providers_unique_primary
    ON oauth_providers (user_id, provider)
    WHERE is_primary = TRUE;

-- Create trigger for updated_at
CREATE TRIGGER oauth_providers_updated_at
    BEFORE UPDATE ON oauth_providers
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Create function to link OAuth account
CREATE OR REPLACE FUNCTION link_oauth_account(
    target_user_id UUID,
    oauth_provider VARCHAR(20),
    oauth_provider_user_id VARCHAR(255),
    oauth_access_token TEXT DEFAULT NULL,
    oauth_refresh_token TEXT DEFAULT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    oauth_profile_data JSONB DEFAULT NULL,
    set_as_primary BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
    provider_id UUID;
    existing_count INTEGER;
BEGIN
    -- Validate provider
    IF oauth_provider NOT IN ('GOOGLE', 'GITHUB', 'FACEBOOK', 'MICROSOFT', 'APPLE') THEN
        RAISE EXCEPTION 'Invalid OAuth provider: %', oauth_provider;
    END IF;

    -- Check if this provider account is already linked to another user
    IF EXISTS (
        SELECT 1 FROM oauth_providers
        WHERE provider = oauth_provider
        AND provider_user_id = oauth_provider_user_id
        AND user_id != target_user_id
    ) THEN
        RAISE EXCEPTION 'OAuth account already linked to another user';
    END IF;

    -- If setting as primary, unset other primary providers for this user/provider combination
    IF set_as_primary THEN
        UPDATE oauth_providers
        SET is_primary = FALSE
        WHERE user_id = target_user_id
        AND provider = oauth_provider
        AND is_primary = TRUE;
    END IF;

    -- Insert or update OAuth provider record
    INSERT INTO oauth_providers (
        user_id,
        provider,
        provider_user_id,
        access_token,
        refresh_token,
        expires_at,
        profile_data,
        is_primary,
        last_login_at
    ) VALUES (
        target_user_id,
        oauth_provider,
        oauth_provider_user_id,
        oauth_access_token,
        oauth_refresh_token,
        token_expires_at,
        oauth_profile_data,
        set_as_primary,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (provider, provider_user_id)
    DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        profile_data = EXCLUDED.profile_data,
        is_primary = EXCLUDED.is_primary,
        last_login_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO provider_id;

    RETURN provider_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to update OAuth tokens
CREATE OR REPLACE FUNCTION update_oauth_tokens(
    target_user_id UUID,
    oauth_provider VARCHAR(20),
    new_access_token TEXT,
    new_refresh_token TEXT DEFAULT NULL,
    new_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE oauth_providers
    SET
        access_token = new_access_token,
        refresh_token = COALESCE(new_refresh_token, refresh_token),
        expires_at = new_expires_at,
        last_login_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = target_user_id
    AND provider = oauth_provider;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's OAuth providers
CREATE OR REPLACE FUNCTION get_user_oauth_providers(target_user_id UUID)
RETURNS TABLE (
    provider_id UUID,
    provider VARCHAR(20),
    provider_user_id VARCHAR(255),
    is_primary BOOLEAN,
    has_valid_token BOOLEAN,
    last_login_at TIMESTAMP WITH TIME ZONE,
    profile_email TEXT,
    profile_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        op.id as provider_id,
        op.provider,
        op.provider_user_id,
        op.is_primary,
        (op.access_token IS NOT NULL AND (op.expires_at IS NULL OR op.expires_at > CURRENT_TIMESTAMP)) as has_valid_token,
        op.last_login_at,
        op.profile_data->>'email' as profile_email,
        COALESCE(
            op.profile_data->>'name',
            op.profile_data->>'display_name',
            CONCAT(op.profile_data->>'first_name', ' ', op.profile_data->>'last_name')
        ) as profile_name
    FROM oauth_providers op
    WHERE op.user_id = target_user_id
    ORDER BY op.is_primary DESC, op.last_login_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Create function to find user by OAuth provider
CREATE OR REPLACE FUNCTION find_user_by_oauth_provider(
    oauth_provider VARCHAR(20),
    oauth_provider_user_id VARCHAR(255)
) RETURNS TABLE (
    user_id UUID,
    email CITEXT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN,
    deleted_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.deleted_at
    FROM oauth_providers op
    JOIN users u ON op.user_id = u.id
    WHERE op.provider = oauth_provider
    AND op.provider_user_id = oauth_provider_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for OAuth provider statistics
CREATE VIEW oauth_provider_stats AS
SELECT
    provider,
    COUNT(*) as total_accounts,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(CASE WHEN is_primary THEN 1 END) as primary_accounts,
    COUNT(CASE WHEN access_token IS NOT NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) THEN 1 END) as active_tokens,
    COUNT(CASE WHEN last_login_at > CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END) as recent_logins
FROM oauth_providers
GROUP BY provider
ORDER BY total_accounts DESC;

-- Add table comment
COMMENT ON TABLE oauth_providers IS 'OAuth provider accounts linked to users for social authentication';

-- Add column comments
COMMENT ON COLUMN oauth_providers.id IS 'Unique identifier for the OAuth provider link';
COMMENT ON COLUMN oauth_providers.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN oauth_providers.provider IS 'OAuth provider name (GOOGLE, GITHUB, FACEBOOK, MICROSOFT, APPLE)';
COMMENT ON COLUMN oauth_providers.provider_user_id IS 'User ID from the OAuth provider';
COMMENT ON COLUMN oauth_providers.access_token IS 'OAuth access token (encrypted in production)';
COMMENT ON COLUMN oauth_providers.refresh_token IS 'OAuth refresh token (encrypted in production)';
COMMENT ON COLUMN oauth_providers.expires_at IS 'Access token expiration timestamp';
COMMENT ON COLUMN oauth_providers.profile_data IS 'JSON data from OAuth provider profile';
COMMENT ON COLUMN oauth_providers.is_primary IS 'Whether this is the primary OAuth account for this provider';
COMMENT ON COLUMN oauth_providers.last_login_at IS 'Timestamp of last login using this OAuth provider';

-- Add function comments
COMMENT ON FUNCTION link_oauth_account(UUID, VARCHAR, VARCHAR, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, JSONB, BOOLEAN) IS 'Links an OAuth account to a user with conflict handling';
COMMENT ON FUNCTION update_oauth_tokens(UUID, VARCHAR, TEXT, TEXT, TIMESTAMP WITH TIME ZONE) IS 'Updates OAuth access and refresh tokens for a user provider';
COMMENT ON FUNCTION get_user_oauth_providers(UUID) IS 'Returns all OAuth providers linked to a user';
COMMENT ON FUNCTION find_user_by_oauth_provider(VARCHAR, VARCHAR) IS 'Finds a user by their OAuth provider account';

-- Verify table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'oauth_providers' AND table_schema = current_schema()
    ) THEN
        RAISE EXCEPTION 'OAuth providers table creation failed';
    END IF;

    RAISE NOTICE 'OAuth providers table created successfully with % indexes',
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'oauth_providers');
END $$;