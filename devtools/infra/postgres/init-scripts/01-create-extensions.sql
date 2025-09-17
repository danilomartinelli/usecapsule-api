-- ============================================================================
-- PostgreSQL Database Initialization Script
-- ============================================================================
-- This script runs on all PostgreSQL containers during initialization
-- to create common extensions and configurations used across all services.
--
-- Extensions created:
-- - uuid-ossp: For UUID generation
-- - pgcrypto: For cryptographic functions
-- - citext: For case-insensitive text
-- ============================================================================

-- Create UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create pgcrypto extension for password hashing and encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create citext extension for case-insensitive text operations
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create basic auditing columns functions
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Log successful extension creation
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL extensions and functions created successfully';
END $$;
