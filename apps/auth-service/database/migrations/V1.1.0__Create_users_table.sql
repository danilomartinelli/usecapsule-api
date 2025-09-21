-- ============================================================================
-- Auth Service - Users Table Migration
-- ============================================================================
-- Version: 1.1.0
-- Description: Create users table with complete authentication fields
-- Service: auth-service
-- Author: Capsule Platform Team
-- Dependencies: V1.0.0__Initial_setup.sql
-- ============================================================================
--
-- This migration creates the core users table with:
-- - User authentication and profile data
-- - Email verification and security fields
-- - Account locking and two-factor authentication support
-- - Soft delete capability with proper indexing
-- - Audit timestamps and timezone/locale settings
--
-- ============================================================================

-- Create users table based on UserSchema
CREATE TABLE users (
    -- Base entity fields
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Soft delete support
    deleted_at TIMESTAMP WITH TIME ZONE NULL,

    -- Authentication fields
    email CITEXT NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- Profile fields
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    profile_picture_url TEXT NULL,

    -- Email verification
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE NULL,

    -- Security fields
    last_login_at TIMESTAMP WITH TIME ZONE NULL,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_at TIMESTAMP WITH TIME ZONE NULL,

    -- Account status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- User preferences
    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    locale VARCHAR(10) NOT NULL DEFAULT 'en',

    -- Two-factor authentication
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,

    -- Constraints
    CONSTRAINT users_email_length CHECK (char_length(email) <= 255),
    CONSTRAINT users_first_name_not_empty CHECK (char_length(first_name) > 0),
    CONSTRAINT users_last_name_not_empty CHECK (char_length(last_name) > 0),
    CONSTRAINT users_password_hash_not_empty CHECK (char_length(password_hash) > 0),
    CONSTRAINT users_failed_attempts_non_negative CHECK (failed_login_attempts >= 0),
    CONSTRAINT users_email_verified_consistency CHECK (
        (email_verified = TRUE AND email_verified_at IS NOT NULL) OR
        (email_verified = FALSE)
    )
);

-- Create indexes for performance
CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users (created_at);
CREATE INDEX idx_users_updated_at ON users (updated_at);
CREATE INDEX idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_users_email_verified ON users (email_verified);
CREATE INDEX idx_users_is_active ON users (is_active);
CREATE INDEX idx_users_last_login_at ON users (last_login_at);
CREATE INDEX idx_users_locked_at ON users (locked_at) WHERE locked_at IS NOT NULL;
CREATE INDEX idx_users_two_factor_enabled ON users (two_factor_enabled);

-- Create composite index for authentication queries
CREATE INDEX idx_users_auth_lookup ON users (email, is_active) WHERE deleted_at IS NULL;

-- Create trigger for updated_at
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Create audit trigger for users table
-- Note: This assumes an audit function exists or will be created
-- CREATE TRIGGER users_audit_trigger
--     AFTER INSERT OR UPDATE OR DELETE ON users
--     FOR EACH ROW
--     EXECUTE FUNCTION audit_table_changes();

-- Add table comment
COMMENT ON TABLE users IS 'Core users table for authentication and user profile management';

-- Add column comments
COMMENT ON COLUMN users.id IS 'Unique identifier for the user';
COMMENT ON COLUMN users.email IS 'User email address (case-insensitive, unique)';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hashed password';
COMMENT ON COLUMN users.first_name IS 'User first name';
COMMENT ON COLUMN users.last_name IS 'User last name';
COMMENT ON COLUMN users.email_verified IS 'Whether the user email has been verified';
COMMENT ON COLUMN users.email_verified_at IS 'Timestamp when email was verified';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last successful login';
COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.locked_at IS 'Timestamp when account was locked due to failed attempts';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';
COMMENT ON COLUMN users.timezone IS 'User preferred timezone';
COMMENT ON COLUMN users.locale IS 'User preferred language/locale';
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether two-factor authentication is enabled';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp (NULL = not deleted)';

-- Verify table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'users' AND table_schema = current_schema()
    ) THEN
        RAISE EXCEPTION 'Users table creation failed';
    END IF;

    RAISE NOTICE 'Users table created successfully with % indexes',
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'users');
END $$;