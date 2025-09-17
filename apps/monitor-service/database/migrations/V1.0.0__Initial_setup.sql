-- ============================================================================
-- Monitor Service - Initial Database Setup (TimescaleDB)
-- ============================================================================
-- Version: 1.0.0
-- Description: Initial schema setup for monitoring service with TimescaleDB
-- Service: monitor-service
-- Author: Capsule Platform Team
-- Created: 2024-09-16
-- ============================================================================
--
-- This migration establishes the foundational database structure for the
-- monitoring service including:
-- - Database connectivity verification
-- - TimescaleDB extension setup
-- - Basic schema setup for metrics and observability
-- - Extension validation
-- - Audit logging preparation
--
-- Note: This is an initial setup migration to verify infrastructure.
-- Actual table creation will follow in subsequent migrations.
-- ============================================================================

-- Verify database connection and basic functionality
DO $$
BEGIN
    RAISE NOTICE 'Starting Monitor Service database initialization...';
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE 'User: %', current_user;
    RAISE NOTICE 'Timestamp: %', CURRENT_TIMESTAMP;
END $$;

-- Create TimescaleDB extension (primary feature for time-series data)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Verify required extensions are available
DO $$
BEGIN
    -- Check TimescaleDB extension
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        RAISE EXCEPTION 'Required extension timescaledb is not available';
    END IF;

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
CREATE SCHEMA IF NOT EXISTS monitor_schema;

-- Set search path to include our schema
SET search_path TO public, monitor_schema;

-- Create a simple configuration table to verify write operations
CREATE TABLE IF NOT EXISTS monitor_service_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for updated_at
CREATE TRIGGER monitor_service_config_updated_at
    BEFORE UPDATE ON monitor_service_config
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Insert initial configuration specific to monitoring
INSERT INTO monitor_service_config (key, value, description) VALUES
    ('schema_version', '1.0.0', 'Current database schema version'),
    ('service_name', 'monitor-service', 'Service identifier'),
    ('initialized_at', CURRENT_TIMESTAMP::TEXT, 'Database initialization timestamp'),
    ('metrics_retention_days', '90', 'Number of days to retain metrics data'),
    ('collection_interval_seconds', '60', 'Default metrics collection interval'),
    ('alert_cpu_threshold', '80', 'CPU usage alert threshold percentage'),
    ('alert_memory_threshold', '85', 'Memory usage alert threshold percentage'),
    ('timescale_enabled', 'true', 'TimescaleDB extension status')
ON CONFLICT (key) DO NOTHING;

-- Create metric type enum for future use
CREATE TYPE metric_type AS ENUM (
    'counter',
    'gauge',
    'histogram',
    'summary'
);

-- Create alert severity enum
CREATE TYPE alert_severity AS ENUM (
    'info',
    'warning',
    'error',
    'critical'
);

-- Create a simple metric definitions reference table
CREATE TABLE IF NOT EXISTS metric_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    metric_type metric_type NOT NULL,
    unit VARCHAR(50),
    help_text TEXT,
    labels TEXT[], -- Array of expected label names
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for metric definitions table
CREATE TRIGGER metric_definitions_updated_at
    BEFORE UPDATE ON metric_definitions
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Insert default metric definitions
INSERT INTO metric_definitions (name, description, metric_type, unit, help_text, labels) VALUES
    ('cpu_usage_percent', 'CPU usage percentage', 'gauge', 'percent', 'Current CPU usage as a percentage', ARRAY['service', 'instance']),
    ('memory_usage_bytes', 'Memory usage in bytes', 'gauge', 'bytes', 'Current memory usage in bytes', ARRAY['service', 'instance']),
    ('http_requests_total', 'Total HTTP requests', 'counter', 'requests', 'Total number of HTTP requests', ARRAY['method', 'status', 'endpoint']),
    ('http_request_duration_seconds', 'HTTP request duration', 'histogram', 'seconds', 'Duration of HTTP requests in seconds', ARRAY['method', 'endpoint']),
    ('database_connections_active', 'Active database connections', 'gauge', 'connections', 'Number of active database connections', ARRAY['database', 'service'])
ON CONFLICT (name) DO NOTHING;

-- Create a simple health check table to verify TimescaleDB functionality
CREATE TABLE IF NOT EXISTS health_checks (
    id UUID DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, checked_at)
);

-- Convert to hypertable for time-series functionality (TimescaleDB feature)
SELECT create_hypertable('health_checks', 'checked_at', if_not_exists => TRUE);

-- Insert a test health check entry
INSERT INTO health_checks (service_name, status, response_time_ms) VALUES
    ('monitor-service', 'healthy', 0);

-- Verify table creation and data insertion
DO $$
DECLARE
    config_count INTEGER;
    definition_count INTEGER;
    health_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO config_count FROM monitor_service_config;
    SELECT COUNT(*) INTO definition_count FROM metric_definitions;
    SELECT COUNT(*) INTO health_count FROM health_checks;

    IF config_count < 8 THEN
        RAISE EXCEPTION 'Configuration table setup failed. Expected at least 8 rows, found %', config_count;
    END IF;

    IF definition_count < 5 THEN
        RAISE EXCEPTION 'Metric definitions table setup failed. Expected at least 5 rows, found %', definition_count;
    END IF;

    IF health_count < 1 THEN
        RAISE EXCEPTION 'Health checks table setup failed. Expected at least 1 row, found %', health_count;
    END IF;

    RAISE NOTICE 'Monitor Service database initialization completed successfully';
    RAISE NOTICE 'Configuration entries: %', config_count;
    RAISE NOTICE 'Metric definition entries: %', definition_count;
    RAISE NOTICE 'Health check entries: %', health_count;
    RAISE NOTICE 'TimescaleDB hypertable created for health_checks';
END $$;