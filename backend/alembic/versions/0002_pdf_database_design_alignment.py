"""align database with PDF design guide

Revision ID: 0002_pdf_database_design_alignment
Revises: 0001_initial_schema
Create Date: 2026-05-21

Adds the database-level pieces called out in the B2B SaaS Billing
PostgreSQL design guide: UUID support, generic audit/soft-delete columns,
role tables, logging tables, and reusable stored procedures.
"""
from alembic import op


revision = "0002_pdf_database_design_alignment"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


BASE_TABLES = [
    "tenants",
    "users",
    "audit_logs",
    "clients",
    "client_contacts",
    "client_communications",
    "product_categories",
    "warehouses",
    "products",
    "inventory_levels",
    "stock_transactions",
    "invoices",
    "invoice_items",
    "invoice_payments",
    "purchase_orders",
    "po_items",
    "projects",
    "project_plans",
    "blocks",
    "material_catalog",
    "stocks",
    "material_requests",
    "material_request_items",
    "work_orders",
    "daily_activities",
    "weekly_bills",
]


def _add_column_if_missing(table: str, column: str, definition: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF to_regclass('{table}') IS NOT NULL
               AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = '{table}'
                      AND column_name = '{column}'
               )
            THEN
                ALTER TABLE {table} ADD COLUMN {column} {definition};
            END IF;
        END $$;
        """
    )


def _create_index_if_table_exists(name: str, table: str, columns: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF to_regclass('{table}') IS NOT NULL THEN
                CREATE INDEX IF NOT EXISTS {name} ON {table} ({columns});
            END IF;
        END $$;
        """
    )


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')

    for table in BASE_TABLES:
        _add_column_if_missing(table, "uuid", "UUID UNIQUE NOT NULL DEFAULT gen_random_uuid()")
        _add_column_if_missing(table, "created_date", "TIMESTAMP NOT NULL DEFAULT NOW()")
        _add_column_if_missing(table, "updated_date", "TIMESTAMP NOT NULL DEFAULT NOW()")
        _add_column_if_missing(table, "created_by", "BIGINT REFERENCES users(id)")
        _add_column_if_missing(table, "updated_by", "BIGINT REFERENCES users(id)")
        _add_column_if_missing(table, "is_active", "BOOLEAN DEFAULT true")
        _add_column_if_missing(table, "is_deleted", "BOOLEAN DEFAULT false")
        _add_column_if_missing(table, "deleted_date", "TIMESTAMP NULL")
        _add_column_if_missing(table, "deleted_by", "BIGINT REFERENCES users(id)")

        _create_index_if_table_exists(f"idx_{table}_uuid", table, "uuid")
        _create_index_if_table_exists(f"idx_{table}_created_date", table, "created_date")
        _create_index_if_table_exists(f"idx_{table}_is_active", table, "is_active")
        _create_index_if_table_exists(f"idx_{table}_is_deleted", table, "is_deleted")

    for column, definition in {
        "entity_type": "VARCHAR(100)",
        "entity_id": "BIGINT",
        "old_values": "JSONB",
        "new_values": "JSONB",
        "change_summary": "TEXT",
        "http_method": "VARCHAR(10)",
        "endpoint": "VARCHAR(255)",
        "status": "VARCHAR(50)",
        "error_message": "TEXT",
    }.items():
        _add_column_if_missing("audit_logs", column, definition)
    _create_index_if_table_exists("idx_audit_logs_entity_type_id", "audit_logs", "entity_type, entity_id")
    _create_index_if_table_exists("idx_audit_logs_created_date", "audit_logs", "created_date")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS roles (
            id BIGSERIAL PRIMARY KEY,
            uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
            role_name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            created_date TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_date TIMESTAMP NOT NULL DEFAULT NOW(),
            created_by BIGINT REFERENCES users(id),
            updated_by BIGINT REFERENCES users(id),
            is_deleted BOOLEAN DEFAULT false,
            deleted_date TIMESTAMP NULL,
            deleted_by BIGINT REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_roles_uuid ON roles(uuid);
        CREATE INDEX IF NOT EXISTS idx_roles_role_name ON roles(role_name);

        INSERT INTO roles (role_name, description)
        VALUES
            ('SUPER_ADMIN', 'Full system access'),
            ('ADMIN', 'Administrative functions'),
            ('PRIMARY_USER', 'Full operational access'),
            ('SECONDARY_USER', 'Limited operational access')
        ON CONFLICT (role_name) DO NOTHING;

        CREATE TABLE IF NOT EXISTS user_roles (
            id BIGSERIAL PRIMARY KEY,
            uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id BIGINT NOT NULL REFERENCES roles(id),
            created_date TIMESTAMP NOT NULL DEFAULT NOW(),
            created_by BIGINT REFERENCES users(id),
            is_deleted BOOLEAN DEFAULT false,
            deleted_date TIMESTAMP NULL,
            deleted_by BIGINT REFERENCES users(id),
            UNIQUE(user_id, role_id)
        );
        CREATE INDEX IF NOT EXISTS idx_user_roles_uuid ON user_roles(uuid);
        CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS error_logs (
            id BIGSERIAL PRIMARY KEY,
            uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
            error_code VARCHAR(50),
            error_type VARCHAR(100),
            error_message TEXT NOT NULL,
            error_stack_trace TEXT,
            service_name VARCHAR(100),
            function_name VARCHAR(255),
            file_path VARCHAR(255),
            line_number INT,
            user_id BIGINT REFERENCES users(id),
            request_id VARCHAR(100),
            endpoint VARCHAR(255),
            http_method VARCHAR(10),
            ip_address VARCHAR(45),
            entity_type VARCHAR(100),
            entity_id BIGINT,
            severity VARCHAR(50),
            is_resolved BOOLEAN DEFAULT false,
            resolved_date TIMESTAMP,
            resolution_notes TEXT,
            created_date TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_date TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
        CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
        CREATE INDEX IF NOT EXISTS idx_error_logs_service_name ON error_logs(service_name);
        CREATE INDEX IF NOT EXISTS idx_error_logs_created_date ON error_logs(created_date);
        CREATE INDEX IF NOT EXISTS idx_error_logs_is_resolved ON error_logs(is_resolved);

        CREATE TABLE IF NOT EXISTS activity_logs (
            id BIGSERIAL PRIMARY KEY,
            uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
            activity_type VARCHAR(100),
            activity_description TEXT,
            user_id BIGINT REFERENCES users(id),
            entity_type VARCHAR(100),
            entity_id BIGINT,
            ip_address VARCHAR(45),
            user_agent TEXT,
            endpoint VARCHAR(255),
            created_date TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON activity_logs(activity_type);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_created_date ON activity_logs(created_date);
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION soft_delete_record(
            p_table_name VARCHAR,
            p_id BIGINT,
            p_deleted_by BIGINT
        ) RETURNS void AS $$
        BEGIN
            EXECUTE format(
                'UPDATE %I SET is_deleted = true, is_active = false,
                 deleted_date = NOW(), deleted_by = $1 WHERE id = $2',
                p_table_name
            ) USING p_deleted_by, p_id;
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION restore_record(
            p_table_name VARCHAR,
            p_id BIGINT
        ) RETURNS void AS $$
        BEGIN
            EXECUTE format(
                'UPDATE %I SET is_deleted = false, is_active = true,
                 deleted_date = NULL, deleted_by = NULL WHERE id = $1',
                p_table_name
            ) USING p_id;
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION log_audit_entry(
            p_user_id BIGINT,
            p_action VARCHAR,
            p_entity_type VARCHAR,
            p_entity_id BIGINT,
            p_old_values JSONB,
            p_new_values JSONB,
            p_status VARCHAR
        ) RETURNS void AS $$
        BEGIN
            INSERT INTO audit_logs (
                user_id, action, entity_type, entity_id,
                old_values, new_values, status, created_date
            ) VALUES (
                p_user_id, p_action, p_entity_type, p_entity_id,
                p_old_values, p_new_values, p_status, NOW()
            );
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION log_error(
            p_error_code VARCHAR,
            p_error_type VARCHAR,
            p_error_message TEXT,
            p_error_stack_trace TEXT,
            p_service_name VARCHAR,
            p_severity VARCHAR,
            p_user_id BIGINT DEFAULT NULL
        ) RETURNS BIGINT AS $$
        DECLARE
            v_error_id BIGINT;
        BEGIN
            INSERT INTO error_logs (
                error_code, error_type, error_message, error_stack_trace,
                service_name, severity, user_id, created_date
            ) VALUES (
                p_error_code, p_error_type, p_error_message, p_error_stack_trace,
                p_service_name, p_severity, p_user_id, NOW()
            ) RETURNING id INTO v_error_id;

            RETURN v_error_id;
        END;
        $$ LANGUAGE plpgsql;
        """
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS log_error(VARCHAR, VARCHAR, TEXT, TEXT, VARCHAR, VARCHAR, BIGINT);")
    op.execute("DROP FUNCTION IF EXISTS log_audit_entry(BIGINT, VARCHAR, VARCHAR, BIGINT, JSONB, JSONB, VARCHAR);")
    op.execute("DROP FUNCTION IF EXISTS restore_record(VARCHAR, BIGINT);")
    op.execute("DROP FUNCTION IF EXISTS soft_delete_record(VARCHAR, BIGINT, BIGINT);")
    op.execute("DROP TABLE IF EXISTS activity_logs;")
    op.execute("DROP TABLE IF EXISTS error_logs;")
    op.execute("DROP TABLE IF EXISTS user_roles;")
    op.execute("DROP TABLE IF EXISTS roles;")
