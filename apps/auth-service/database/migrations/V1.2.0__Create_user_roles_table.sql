-- ============================================================================
-- Auth Service - User Roles Table Migration
-- ============================================================================
-- Version: 1.2.0
-- Description: Create user_roles table for role-based access control
-- Service: auth-service
-- Author: Capsule Platform Team
-- Dependencies: V1.1.0__Create_users_table.sql
-- ============================================================================
--
-- This migration creates the user_roles table with:
-- - Role assignments with USER/ADMIN/SUPERADMIN hierarchy
-- - Role expiration and assignment tracking
-- - Foreign key relationships to users
-- - Audit trail for role changes
--
-- ============================================================================

-- Create user_roles table based on UserRoleSchema
CREATE TABLE user_roles (
    -- Base entity fields
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,

    -- Role assignment fields
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NULL,

    -- Constraints
    CONSTRAINT user_roles_role_valid CHECK (role IN ('USER', 'ADMIN', 'SUPERADMIN')),

    -- Foreign key constraints
    CONSTRAINT fk_user_roles_user_id
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_user_roles_granted_by
        FOREIGN KEY (granted_by) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    -- Business logic constraints
    CONSTRAINT user_roles_granted_at_not_future
        CHECK (granted_at <= CURRENT_TIMESTAMP),
    CONSTRAINT user_roles_expires_after_granted
        CHECK (expires_at IS NULL OR expires_at > granted_at)
);

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX idx_user_roles_role ON user_roles (role);
CREATE INDEX idx_user_roles_granted_by ON user_roles (granted_by);
CREATE INDEX idx_user_roles_granted_at ON user_roles (granted_at);
CREATE INDEX idx_user_roles_expires_at ON user_roles (expires_at) WHERE expires_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_user_roles_user_active ON user_roles (user_id, role)
    WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;
CREATE INDEX idx_user_roles_lookup ON user_roles (user_id, role, expires_at);

-- Unique constraint to prevent duplicate active role assignments
CREATE UNIQUE INDEX idx_user_roles_unique_active
    ON user_roles (user_id, role)
    WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

-- Create trigger for updated_at
CREATE TRIGGER user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Create function to check role hierarchy for assignment validation
CREATE OR REPLACE FUNCTION validate_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent users from granting roles higher than their own
    -- SUPERADMIN can grant any role
    -- ADMIN can grant USER roles only
    -- USER cannot grant any roles
    IF NEW.role = 'SUPERADMIN' THEN
        -- Only SUPERADMIN can grant SUPERADMIN role
        IF NOT EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = NEW.granted_by
            AND ur.role = 'SUPERADMIN'
            AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
        ) THEN
            RAISE EXCEPTION 'Only SUPERADMIN users can grant SUPERADMIN role';
        END IF;
    ELSIF NEW.role = 'ADMIN' THEN
        -- SUPERADMIN can grant ADMIN role
        IF NOT EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = NEW.granted_by
            AND ur.role IN ('SUPERADMIN')
            AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
        ) THEN
            RAISE EXCEPTION 'Only SUPERADMIN users can grant ADMIN role';
        END IF;
    ELSIF NEW.role = 'USER' THEN
        -- ADMIN or SUPERADMIN can grant USER role
        IF NOT EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = NEW.granted_by
            AND ur.role IN ('ADMIN', 'SUPERADMIN')
            AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
        ) THEN
            RAISE EXCEPTION 'Only ADMIN or SUPERADMIN users can grant USER role';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for role assignment validation
CREATE TRIGGER user_roles_validate_assignment
    BEFORE INSERT ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION validate_role_assignment();

-- Add table comment
COMMENT ON TABLE user_roles IS 'User role assignments for role-based access control (RBAC)';

-- Add column comments
COMMENT ON COLUMN user_roles.id IS 'Unique identifier for the role assignment';
COMMENT ON COLUMN user_roles.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN user_roles.role IS 'Role name: USER, ADMIN, or SUPERADMIN';
COMMENT ON COLUMN user_roles.granted_at IS 'Timestamp when the role was granted';
COMMENT ON COLUMN user_roles.granted_by IS 'User ID who granted this role';
COMMENT ON COLUMN user_roles.expires_at IS 'Optional expiration timestamp for the role';

-- Create view for active user roles
CREATE VIEW active_user_roles AS
SELECT
    ur.id,
    ur.user_id,
    ur.role,
    ur.granted_at,
    ur.granted_by,
    ur.expires_at,
    u.email as user_email,
    u.first_name,
    u.last_name,
    gb.email as granted_by_email
FROM user_roles ur
JOIN users u ON ur.user_id = u.id
JOIN users gb ON ur.granted_by = gb.id
WHERE u.deleted_at IS NULL
AND u.is_active = TRUE
AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP);

-- Add comment to view
COMMENT ON VIEW active_user_roles IS 'View showing all active role assignments with user details';

-- Verify table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'user_roles' AND table_schema = current_schema()
    ) THEN
        RAISE EXCEPTION 'User roles table creation failed';
    END IF;

    RAISE NOTICE 'User roles table created successfully with % indexes',
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'user_roles');
END $$;