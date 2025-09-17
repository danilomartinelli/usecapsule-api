-- ============================================================================
-- Deploy Service - Initial Database Setup
-- ============================================================================
-- Version: 1.0.0
-- Description: Initial schema setup for deployment service
-- Service: deploy-service
-- Author: Capsule Platform Team
-- Created: 2024-09-16
-- ============================================================================
--
-- This migration establishes the foundational database structure for the
-- deployment service including:
-- - Database connectivity verification
-- - Basic schema setup for deployment orchestration
-- - Extension validation
-- - Audit logging preparation
--
-- Note: This is an initial setup migration to verify infrastructure.
-- Actual table creation will follow in subsequent migrations.
-- ============================================================================

-- Verify database connection and basic functionality
DO $$
BEGIN
    RAISE NOTICE 'Starting Deploy Service database initialization...';
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
CREATE SCHEMA IF NOT EXISTS deploy_schema;

-- Set search path to include our schema
SET search_path TO public, deploy_schema;

-- Create a simple configuration table to verify write operations
CREATE TABLE IF NOT EXISTS deploy_service_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for updated_at
CREATE TRIGGER deploy_service_config_updated_at
    BEFORE UPDATE ON deploy_service_config
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Insert initial configuration specific to deployment
INSERT INTO deploy_service_config (key, value, description) VALUES
    ('schema_version', '1.0.0', 'Current database schema version'),
    ('service_name', 'deploy-service', 'Service identifier'),
    ('initialized_at', CURRENT_TIMESTAMP::TEXT, 'Database initialization timestamp'),
    ('max_concurrent_builds', '5', 'Maximum concurrent build operations'),
    ('build_timeout_seconds', '600', 'Default build timeout in seconds'),
    ('registry_url', 'registry.capsule.dev', 'Default container registry URL')
ON CONFLICT (key) DO NOTHING;

-- Create deployment status enum for future use
CREATE TYPE deployment_status AS ENUM (
    'pending',
    'building',
    'deploying',
    'running',
    'stopped',
    'failed',
    'cancelled'
);

-- Create a simple deployment environment reference table
CREATE TABLE IF NOT EXISTS deployment_environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_production BOOLEAN DEFAULT false,
    max_replicas INTEGER DEFAULT 3,
    resource_quota_cpu VARCHAR(20) DEFAULT '1000m',
    resource_quota_memory VARCHAR(20) DEFAULT '1Gi',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for environments table
CREATE TRIGGER deployment_environments_updated_at
    BEFORE UPDATE ON deployment_environments
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Insert default environments
INSERT INTO deployment_environments (name, description, is_production, max_replicas, resource_quota_cpu, resource_quota_memory) VALUES
    ('development', 'Development environment for testing', false, 1, '500m', '512Mi'),
    ('staging', 'Staging environment for pre-production testing', false, 2, '750m', '1Gi'),
    ('production', 'Production environment', true, 5, '2000m', '2Gi')
ON CONFLICT (name) DO NOTHING;

-- Verify table creation and data insertion
DO $$
DECLARE
    config_count INTEGER;
    env_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO config_count FROM deploy_service_config;
    SELECT COUNT(*) INTO env_count FROM deployment_environments;

    IF config_count < 6 THEN
        RAISE EXCEPTION 'Configuration table setup failed. Expected at least 6 rows, found %', config_count;
    END IF;

    IF env_count < 3 THEN
        RAISE EXCEPTION 'Environment table setup failed. Expected at least 3 rows, found %', env_count;
    END IF;

    RAISE NOTICE 'Deploy Service database initialization completed successfully';
    RAISE NOTICE 'Configuration entries: %', config_count;
    RAISE NOTICE 'Environment entries: %', env_count;
END $$;