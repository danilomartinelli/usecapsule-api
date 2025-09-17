-- ============================================================================
-- Billing Service - Initial Database Setup
-- ============================================================================
-- Version: 1.0.0
-- Description: Initial schema setup for billing service
-- Service: billing-service
-- Author: Capsule Platform Team
-- Created: 2024-09-16
-- ============================================================================
--
-- This migration establishes the foundational database structure for the
-- billing service including:
-- - Database connectivity verification
-- - Basic schema setup for payment processing
-- - Extension validation
-- - Audit logging preparation
--
-- Note: This is an initial setup migration to verify infrastructure.
-- Actual table creation will follow in subsequent migrations.
-- ============================================================================

-- Verify database connection and basic functionality
DO $$
BEGIN
    RAISE NOTICE 'Starting Billing Service database initialization...';
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
CREATE SCHEMA IF NOT EXISTS billing_schema;

-- Set search path to include our schema
SET search_path TO public, billing_schema;

-- Create a simple configuration table to verify write operations
CREATE TABLE IF NOT EXISTS billing_service_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for updated_at
CREATE TRIGGER billing_service_config_updated_at
    BEFORE UPDATE ON billing_service_config
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Insert initial configuration specific to billing
INSERT INTO billing_service_config (key, value, description) VALUES
    ('schema_version', '1.0.0', 'Current database schema version'),
    ('service_name', 'billing-service', 'Service identifier'),
    ('initialized_at', CURRENT_TIMESTAMP::TEXT, 'Database initialization timestamp'),
    ('currency_default', 'USD', 'Default currency for billing operations'),
    ('payment_retry_limit', '3', 'Maximum payment retry attempts')
ON CONFLICT (key) DO NOTHING;

-- Create a simple currency reference table for billing operations
CREATE TABLE IF NOT EXISTS supported_currencies (
    code CHAR(3) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10),
    decimal_places SMALLINT DEFAULT 2,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert common currencies
INSERT INTO supported_currencies (code, name, symbol, decimal_places) VALUES
    ('USD', 'US Dollar', '$', 2),
    ('EUR', 'Euro', '€', 2),
    ('GBP', 'British Pound', '£', 2),
    ('BRL', 'Brazilian Real', 'R$', 2)
ON CONFLICT (code) DO NOTHING;

-- Verify table creation and data insertion
DO $$
DECLARE
    config_count INTEGER;
    currency_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO config_count FROM billing_service_config;
    SELECT COUNT(*) INTO currency_count FROM supported_currencies;

    IF config_count < 5 THEN
        RAISE EXCEPTION 'Configuration table setup failed. Expected at least 5 rows, found %', config_count;
    END IF;

    IF currency_count < 4 THEN
        RAISE EXCEPTION 'Currency table setup failed. Expected at least 4 rows, found %', currency_count;
    END IF;

    RAISE NOTICE 'Billing Service database initialization completed successfully';
    RAISE NOTICE 'Configuration entries: %', config_count;
    RAISE NOTICE 'Currency entries: %', currency_count;
END $$;