-- ============================================================================
-- Auth Service - Authentication Audit Logs Table Migration
-- ============================================================================
-- Version: 1.9.0
-- Description: Create auth_audit_logs table for security auditing
-- Service: auth-service
-- Author: Capsule Platform Team
-- Dependencies: V1.1.0__Create_users_table.sql
-- ============================================================================
--
-- This migration creates the auth_audit_logs table with:
-- - Comprehensive authentication event logging
-- - Security event tracking and analysis
-- - IP address and device tracking
-- - Anomaly detection support
--
-- ============================================================================

-- Create auth_audit_logs table based on AuthAuditLogSchema
CREATE TABLE auth_audit_logs (
    -- Base entity fields
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Audit log fields
    user_id UUID NULL,
    event_type VARCHAR(50) NOT NULL,
    event_result VARCHAR(20) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    session_id UUID NULL,
    metadata JSONB NULL,
    risk_score INTEGER NULL,

    -- Constraints
    CONSTRAINT auth_audit_logs_event_type_valid CHECK (
        event_type IN (
            'USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTRATION', 'PASSWORD_CHANGE',
            'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'TWO_FACTOR_SETUP',
            'TWO_FACTOR_DISABLE', 'API_KEY_CREATED', 'API_KEY_REVOKED',
            'OAUTH_LINK', 'OAUTH_UNLINK', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED',
            'ROLE_GRANTED', 'ROLE_REVOKED', 'FAILED_LOGIN', 'SUSPICIOUS_ACTIVITY'
        )
    ),
    CONSTRAINT auth_audit_logs_event_result_valid CHECK (
        event_result IN ('SUCCESS', 'FAILURE', 'BLOCKED', 'PENDING')
    ),
    CONSTRAINT auth_audit_logs_risk_score_range CHECK (
        risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)
    ),

    -- Foreign key constraints (optional user_id for anonymous events)
    CONSTRAINT fk_auth_audit_logs_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_auth_audit_logs_user_id ON auth_audit_logs (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_auth_audit_logs_event_type ON auth_audit_logs (event_type);
CREATE INDEX idx_auth_audit_logs_event_result ON auth_audit_logs (event_result);
CREATE INDEX idx_auth_audit_logs_created_at ON auth_audit_logs (created_at);
CREATE INDEX idx_auth_audit_logs_ip_address ON auth_audit_logs (ip_address);
CREATE INDEX idx_auth_audit_logs_session_id ON auth_audit_logs (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_auth_audit_logs_risk_score ON auth_audit_logs (risk_score) WHERE risk_score IS NOT NULL;
CREATE INDEX idx_auth_audit_logs_metadata ON auth_audit_logs USING GIN (metadata);

-- Composite indexes for common security queries
CREATE INDEX idx_auth_audit_logs_user_events ON auth_audit_logs (user_id, event_type, created_at)
    WHERE user_id IS NOT NULL;
CREATE INDEX idx_auth_audit_logs_failed_attempts ON auth_audit_logs (ip_address, event_type, created_at)
    WHERE event_result = 'FAILURE' AND event_type = 'FAILED_LOGIN';
CREATE INDEX idx_auth_audit_logs_suspicious ON auth_audit_logs (ip_address, risk_score, created_at)
    WHERE risk_score > 70;
CREATE INDEX idx_auth_audit_logs_recent_activity ON auth_audit_logs (user_id, created_at)
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' AND user_id IS NOT NULL;

-- Create trigger for updated_at
CREATE TRIGGER auth_audit_logs_updated_at
    BEFORE UPDATE ON auth_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Create function to log authentication event
CREATE OR REPLACE FUNCTION log_auth_event(
    target_user_id UUID DEFAULT NULL,
    auth_event_type VARCHAR(50),
    auth_event_result VARCHAR(20),
    source_ip_address INET,
    source_user_agent TEXT,
    auth_session_id UUID DEFAULT NULL,
    event_metadata JSONB DEFAULT NULL,
    calculated_risk_score INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    -- Validate event type and result
    IF auth_event_type NOT IN (
        'USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTRATION', 'PASSWORD_CHANGE',
        'PASSWORD_RESET', 'EMAIL_VERIFICATION', 'TWO_FACTOR_SETUP',
        'TWO_FACTOR_DISABLE', 'API_KEY_CREATED', 'API_KEY_REVOKED',
        'OAUTH_LINK', 'OAUTH_UNLINK', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED',
        'ROLE_GRANTED', 'ROLE_REVOKED', 'FAILED_LOGIN', 'SUSPICIOUS_ACTIVITY'
    ) THEN
        RAISE EXCEPTION 'Invalid auth event type: %', auth_event_type;
    END IF;

    IF auth_event_result NOT IN ('SUCCESS', 'FAILURE', 'BLOCKED', 'PENDING') THEN
        RAISE EXCEPTION 'Invalid auth event result: %', auth_event_result;
    END IF;

    -- Insert audit log
    INSERT INTO auth_audit_logs (
        user_id,
        event_type,
        event_result,
        ip_address,
        user_agent,
        session_id,
        metadata,
        risk_score
    ) VALUES (
        target_user_id,
        auth_event_type,
        auth_event_result,
        source_ip_address,
        source_user_agent,
        auth_session_id,
        event_metadata,
        calculated_risk_score
    ) RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's recent activity
CREATE OR REPLACE FUNCTION get_user_recent_activity(
    target_user_id UUID,
    hours_back INTEGER DEFAULT 24,
    limit_count INTEGER DEFAULT 50
) RETURNS TABLE (
    log_id UUID,
    event_type VARCHAR(50),
    event_result VARCHAR(20),
    ip_address INET,
    user_agent TEXT,
    risk_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        aal.id as log_id,
        aal.event_type,
        aal.event_result,
        aal.ip_address,
        aal.user_agent,
        aal.risk_score,
        aal.created_at,
        aal.metadata
    FROM auth_audit_logs aal
    WHERE aal.user_id = target_user_id
    AND aal.created_at > CURRENT_TIMESTAMP - (hours_back || ' hours')::INTERVAL
    ORDER BY aal.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to detect suspicious login patterns
CREATE OR REPLACE FUNCTION detect_suspicious_logins(
    target_user_id UUID DEFAULT NULL,
    hours_back INTEGER DEFAULT 1
) RETURNS TABLE (
    user_id UUID,
    ip_address INET,
    failed_attempts INTEGER,
    unique_user_agents INTEGER,
    risk_level TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        aal.user_id,
        aal.ip_address,
        COUNT(*)::INTEGER as failed_attempts,
        COUNT(DISTINCT aal.user_agent)::INTEGER as unique_user_agents,
        CASE
            WHEN COUNT(*) >= 10 THEN 'HIGH'
            WHEN COUNT(*) >= 5 THEN 'MEDIUM'
            ELSE 'LOW'
        END as risk_level
    FROM auth_audit_logs aal
    WHERE aal.event_type = 'FAILED_LOGIN'
    AND aal.event_result = 'FAILURE'
    AND aal.created_at > CURRENT_TIMESTAMP - (hours_back || ' hours')::INTERVAL
    AND (target_user_id IS NULL OR aal.user_id = target_user_id)
    GROUP BY aal.user_id, aal.ip_address
    HAVING COUNT(*) >= 3
    ORDER BY failed_attempts DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get security metrics
CREATE OR REPLACE FUNCTION get_security_metrics(
    days_back INTEGER DEFAULT 7
) RETURNS TABLE (
    total_events BIGINT,
    successful_logins BIGINT,
    failed_logins BIGINT,
    registrations BIGINT,
    password_changes BIGINT,
    suspicious_activities BIGINT,
    unique_users BIGINT,
    unique_ips BIGINT,
    avg_risk_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_events,
        COUNT(CASE WHEN event_type = 'USER_LOGIN' AND event_result = 'SUCCESS' THEN 1 END) as successful_logins,
        COUNT(CASE WHEN event_type = 'FAILED_LOGIN' AND event_result = 'FAILURE' THEN 1 END) as failed_logins,
        COUNT(CASE WHEN event_type = 'USER_REGISTRATION' THEN 1 END) as registrations,
        COUNT(CASE WHEN event_type = 'PASSWORD_CHANGE' THEN 1 END) as password_changes,
        COUNT(CASE WHEN event_type = 'SUSPICIOUS_ACTIVITY' THEN 1 END) as suspicious_activities,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT ip_address) as unique_ips,
        AVG(risk_score) as avg_risk_score
    FROM auth_audit_logs
    WHERE created_at > CURRENT_TIMESTAMP - (days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Create function for audit log cleanup
CREATE OR REPLACE FUNCTION cleanup_audit_logs(
    retention_days INTEGER DEFAULT 365
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete audit logs older than retention period
    DELETE FROM auth_audit_logs
    WHERE created_at < CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Cleaned up % audit logs older than % days', deleted_count, retention_days;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create views for security monitoring
CREATE VIEW daily_auth_stats AS
SELECT
    DATE_TRUNC('day', created_at) as log_date,
    COUNT(*) as total_events,
    COUNT(CASE WHEN event_result = 'SUCCESS' THEN 1 END) as successful_events,
    COUNT(CASE WHEN event_result = 'FAILURE' THEN 1 END) as failed_events,
    COUNT(CASE WHEN event_type = 'USER_LOGIN' AND event_result = 'SUCCESS' THEN 1 END) as successful_logins,
    COUNT(CASE WHEN event_type = 'FAILED_LOGIN' THEN 1 END) as failed_logins,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips,
    AVG(risk_score) as avg_risk_score
FROM auth_audit_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY log_date DESC;

CREATE VIEW high_risk_events AS
SELECT
    id,
    user_id,
    event_type,
    event_result,
    ip_address,
    risk_score,
    created_at,
    metadata
FROM auth_audit_logs
WHERE risk_score > 70
AND created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY risk_score DESC, created_at DESC;

-- Add table comment
COMMENT ON TABLE auth_audit_logs IS 'Comprehensive audit trail for authentication and security events';

-- Add column comments
COMMENT ON COLUMN auth_audit_logs.id IS 'Unique identifier for the audit log entry';
COMMENT ON COLUMN auth_audit_logs.user_id IS 'Foreign key to users table (NULL for anonymous events)';
COMMENT ON COLUMN auth_audit_logs.event_type IS 'Type of authentication event';
COMMENT ON COLUMN auth_audit_logs.event_result IS 'Result of the event (SUCCESS, FAILURE, BLOCKED, PENDING)';
COMMENT ON COLUMN auth_audit_logs.ip_address IS 'Source IP address of the event';
COMMENT ON COLUMN auth_audit_logs.user_agent IS 'User agent string from the client';
COMMENT ON COLUMN auth_audit_logs.session_id IS 'Associated session ID if applicable';
COMMENT ON COLUMN auth_audit_logs.metadata IS 'Additional event-specific metadata in JSON format';
COMMENT ON COLUMN auth_audit_logs.risk_score IS 'Calculated risk score (0-100) for the event';

-- Add function comments
COMMENT ON FUNCTION log_auth_event(UUID, VARCHAR, VARCHAR, INET, TEXT, UUID, JSONB, INTEGER) IS 'Logs an authentication event with metadata and risk scoring';
COMMENT ON FUNCTION get_user_recent_activity(UUID, INTEGER, INTEGER) IS 'Returns recent authentication activity for a user';
COMMENT ON FUNCTION detect_suspicious_logins(UUID, INTEGER) IS 'Detects suspicious login patterns and brute force attempts';
COMMENT ON FUNCTION get_security_metrics(INTEGER) IS 'Returns security metrics and statistics for a given period';
COMMENT ON FUNCTION cleanup_audit_logs(INTEGER) IS 'Removes audit logs older than specified retention period';

-- Verify table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'auth_audit_logs' AND table_schema = current_schema()
    ) THEN
        RAISE EXCEPTION 'Auth audit logs table creation failed';
    END IF;

    RAISE NOTICE 'Auth audit logs table created successfully with % indexes',
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'auth_audit_logs');
END $$;