-- ============================================================================
-- Auth Service - Initial Database Setup
-- ============================================================================
-- Version: 1.0.0
-- Description: Initial schema setup for authentication service
-- Service: auth-service
-- Author: Capsule Platform Team
-- Created: 2024-09-16
-- ============================================================================
--
-- This migration establishes the foundational database structure for the
-- authentication service including:
-- - Database connectivity verification
-- - Basic schema setup
-- - Extension validation
-- - Audit logging preparation
--
-- Note: This is an initial setup migration to verify infrastructure.
-- Actual table creation will follow in subsequent migrations.
-- ============================================================================

-- Verify database connection and basic functionality
DO $$
BEGIN
    RAISE NOTICE 'Starting Auth Service database initialization...';
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE 'User: %', current_user;
    RAISE NOTICE 'Timestamp: %', CURRENT_TIMESTAMP;
END $$;

-- Verify required extensions are available
DO $$
BEGIN
    -- Check UUID extension
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        RAISE EXCEPTION 'Required extension uuid-ossp is not available';
    END IF;

    -- Check pgcrypto extension
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE EXCEPTION 'Required extension pgcrypto is not available';
    END IF;

    -- Check citext extension
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
        RAISE EXCEPTION 'Required extension citext is not available';
    END IF;

    RAISE NOTICE 'All required extensions are available';
END $$;

-- Create application-specific schema if needed
CREATE SCHEMA IF NOT EXISTS auth_schema;

-- Set search path to include our schema
SET search_path TO public, auth_schema;

-- Create a simple configuration table to verify write operations
CREATE TABLE IF NOT EXISTS auth_service_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for updated_at
CREATE TRIGGER auth_service_config_updated_at
    BEFORE UPDATE ON auth_service_config
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Insert initial configuration
INSERT INTO auth_service_config (key, value, description) VALUES
    ('schema_version', '1.0.0', 'Current database schema version'),
    ('service_name', 'auth-service', 'Service identifier'),
    ('initialized_at', CURRENT_TIMESTAMP::TEXT, 'Database initialization timestamp')
ON CONFLICT (key) DO NOTHING;

-- Verify table creation and data insertion
DO $$
DECLARE
    config_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO config_count FROM auth_service_config;

    IF config_count < 3 THEN
        RAISE EXCEPTION 'Configuration table setup failed. Expected at least 3 rows, found %', config_count;
    END IF;

    RAISE NOTICE 'Auth Service database initialization completed successfully';
    RAISE NOTICE 'Configuration entries: %', config_count;
END $$;