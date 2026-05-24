"""align schema to DATABASE_SPECIFIC_TABLES_SETUP.sql spec

Revision ID: 0003_align_to_sql_spec
Revises: 0002_pdf_database_design_alignment
Create Date: 2026-05-21

Renames all tables to match the SQL spec file and PDF design guide:
  users               → user_accounts
  roles               → user_roles_master
  user_roles          → user_role_assignments
  clients             → customer_master
  client_contacts     → customer_contact_persons
  projects            → civil_projects   (if still old name)
  project_plans       → civil_project_plans
  blocks              → civil_project_blocks
  invoices            → billing_invoices
  invoice_items       → billing_invoice_line_items
  products            → inventory_products_master
  inventory_levels    → inventory_stock_levels
  stock_transactions  → inventory_movement_history
  audit_logs          → system_audit_trail
  error_logs          → system_error_log
  activity_logs       → user_activity_log

Also:
  - Renames created_at/updated_at/deleted_at DB columns to created_date/updated_date/deleted_date
  - Adds missing PDF base columns (uuid, is_deleted, is_active, created_by, updated_by, deleted_by)
  - Backfills is_deleted from deleted_at IS NOT NULL
  - Creates new tables: user_permissions_master, role_permission_assignments,
    project_user_assignments, client_communications (if missing)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0003_align_to_sql_spec"
down_revision = "0002_pdf_database_design_alignment"
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _table_exists(table: str) -> bool:
    return op.get_bind().execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = current_schema() AND table_name = :t)"
        ),
        {"t": table},
    ).scalar()


def _column_exists(table: str, column: str) -> bool:
    return op.get_bind().execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = current_schema() "
            "AND table_name = :t AND column_name = :c)"
        ),
        {"t": table, "c": column},
    ).scalar()


def _rename_table(old: str, new: str) -> None:
    """Rename only if old exists and new does not."""
    if _table_exists(old) and not _table_exists(new):
        op.rename_table(old, new)


def _rename_column(table: str, old_col: str, new_col: str, col_type: str) -> None:
    if _table_exists(table) and _column_exists(table, old_col) and not _column_exists(table, new_col):
        op.execute(f"ALTER TABLE {table} RENAME COLUMN {old_col} TO {new_col}")


def _add_col_if_missing(table: str, column: str, definition: str) -> None:
    if _table_exists(table) and not _column_exists(table, column):
        op.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _safe_create_index(name: str, table: str, columns: str) -> None:
    if _table_exists(table):
        op.execute(
            f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({columns})"
        )


# ---------------------------------------------------------------------------
# Tables to process
# ---------------------------------------------------------------------------

# (old_name, new_name)
TABLE_RENAMES = [
    ("users",              "user_accounts"),
    ("roles",              "user_roles_master"),
    ("user_roles",         "user_role_assignments"),
    ("clients",            "customer_master"),
    ("client_contacts",    "customer_contact_persons"),
    ("projects",           "civil_projects"),
    ("project_plans",      "civil_project_plans"),
    ("blocks",             "civil_project_blocks"),
    ("civil_blocks",       "civil_project_blocks"),       # model alias
    ("civil_project_plans", "civil_project_plans"),       # no-op if already correct
    ("invoices",           "billing_invoices"),
    ("invoice_items",      "billing_invoice_line_items"),
    ("products",           "inventory_products_master"),
    ("inventory_levels",   "inventory_stock_levels"),
    ("stock_transactions", "inventory_movement_history"),
    ("audit_logs",         "system_audit_trail"),
    ("error_logs",         "system_error_log"),
    ("activity_logs",      "user_activity_log"),
]

# Tables that need the full PDF base-column set added after rename
CORE_TABLES_AFTER_RENAME = [
    "user_accounts",
    "user_roles_master",
    "user_role_assignments",
    "customer_master",
    "customer_contact_persons",
    "client_communications",
    "civil_projects",
    "civil_project_plans",
    "civil_project_blocks",
    "billing_invoices",
    "billing_invoice_line_items",
    "invoice_payments",
    "purchase_orders",
    "po_items",
    "inventory_products_master",
    "inventory_stock_levels",
    "inventory_movement_history",
    "product_categories",
    "warehouses",
    "tenants",
    "civil_material_catalog",
    "civil_stock",
    "civil_stock_movements",
    "civil_material_requests",
    "civil_material_request_items",
    "civil_work_orders",
    "civil_daily_activities",
    "civil_weekly_bills",
    "civil_project_allocations",
    "civil_block_allocations",
    "civil_user_utilization_logs",
]


# ---------------------------------------------------------------------------
# upgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')

    # 1. Rename tables -------------------------------------------------------
    for old, new in TABLE_RENAMES:
        _rename_table(old, new)

    # 2. Rename timestamp/soft-delete columns to PDF spec names --------------
    # (created_at → created_date, updated_at → updated_date, deleted_at → deleted_date)
    for table in CORE_TABLES_AFTER_RENAME:
        _rename_column(table, "created_at", "created_date", "TIMESTAMP WITH TIME ZONE")
        _rename_column(table, "updated_at", "updated_date", "TIMESTAMP WITH TIME ZONE")
        _rename_column(table, "deleted_at", "deleted_date", "TIMESTAMP WITH TIME ZONE")

    # system_audit_trail uses action_timestamp instead of created_date
    _rename_column("system_audit_trail", "created_at",    "action_timestamp",  "TIMESTAMP WITH TIME ZONE")
    _rename_column("system_audit_trail", "created_date",  "action_timestamp",  "TIMESTAMP WITH TIME ZONE")

    # system_error_log uses error_timestamp / last_updated
    _rename_column("system_error_log", "created_at",   "error_timestamp", "TIMESTAMP WITH TIME ZONE")
    _rename_column("system_error_log", "created_date", "error_timestamp", "TIMESTAMP WITH TIME ZONE")
    _rename_column("system_error_log", "updated_at",   "last_updated",    "TIMESTAMP WITH TIME ZONE")
    _rename_column("system_error_log", "updated_date", "last_updated",    "TIMESTAMP WITH TIME ZONE")

    # user_activity_log uses activity_timestamp
    _rename_column("user_activity_log", "created_at",   "activity_timestamp", "TIMESTAMP WITH TIME ZONE")
    _rename_column("user_activity_log", "created_date", "activity_timestamp", "TIMESTAMP WITH TIME ZONE")

    # 3. Add missing PDF base columns to all core tables ---------------------
    for table in CORE_TABLES_AFTER_RENAME:
        _add_col_if_missing(table, "uuid",       "UUID UNIQUE NOT NULL DEFAULT gen_random_uuid()")
        _add_col_if_missing(table, "created_date", "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()")
        _add_col_if_missing(table, "updated_date", "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()")
        _add_col_if_missing(table, "created_by",   "BIGINT")
        _add_col_if_missing(table, "updated_by",   "BIGINT")
        _add_col_if_missing(table, "is_active",    "BOOLEAN DEFAULT true")
        _add_col_if_missing(table, "is_deleted",   "BOOLEAN DEFAULT false NOT NULL")
        _add_col_if_missing(table, "deleted_date", "TIMESTAMP WITH TIME ZONE NULL")
        _add_col_if_missing(table, "deleted_by",   "BIGINT")

        _safe_create_index(f"idx_{table}_uuid",         table, "uuid")
        _safe_create_index(f"idx_{table}_created_date", table, "created_date")
        _safe_create_index(f"idx_{table}_is_active",    table, "is_active")
        _safe_create_index(f"idx_{table}_is_deleted",   table, "is_deleted")

    # 4. Backfill is_deleted from deleted_date where applicable --------------
    for table in CORE_TABLES_AFTER_RENAME:
        if _table_exists(table) and _column_exists(table, "deleted_date") and _column_exists(table, "is_deleted"):
            op.execute(
                f"UPDATE {table} SET is_deleted = true WHERE deleted_date IS NOT NULL AND is_deleted = false"
            )

    # 5. Add audit_log-specific columns -------------------------------------
    for col, defn in {
        "entity_type":    "VARCHAR(100)",
        "entity_id":      "BIGINT",
        "old_values":     "JSONB",
        "new_values":     "JSONB",
        "change_summary": "TEXT",
        "http_method":    "VARCHAR(10)",
        "api_endpoint":   "VARCHAR(255)",
        "action_status":  "VARCHAR(50)",
        "error_message":  "TEXT",
        "action_performed": "VARCHAR(100)",
        "table_name":     "VARCHAR(100)",
        "record_id":      "BIGINT",
        "change_description": "TEXT",
        "action_timestamp": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
    }.items():
        _add_col_if_missing("system_audit_trail", col, defn)

    _safe_create_index("idx_audit_entity_type_id", "system_audit_trail", "entity_type, entity_id")
    _safe_create_index("idx_audit_action_timestamp", "system_audit_trail", "action_timestamp")
    _safe_create_index("idx_audit_action_performed", "system_audit_trail", "action_performed")

    # 6. Add billing_invoices-specific columns -----------------------------
    for col, defn in {
        "project_id":       "BIGINT",
        "project_block_id": "BIGINT",
        "payment_status":   "VARCHAR(50) DEFAULT 'UNPAID'",
        "payment_date":     "VARCHAR(20)",
        "payment_mode":     "VARCHAR(50)",
        "subtotal_amount":  "DECIMAL(15,2) DEFAULT 0",
        "tax_amount":       "DECIMAL(15,2) DEFAULT 0",
        "total_amount":     "DECIMAL(15,2) DEFAULT 0",
        "invoice_type":     "VARCHAR(50)",
    }.items():
        _add_col_if_missing("billing_invoices", col, defn)

    # 7. Add inventory_stock_levels-specific columns -----------------------
    for col, defn in {
        "project_id":         "BIGINT",
        "warehouse_location": "VARCHAR(255)",
        "batch_number":       "VARCHAR(100)",
        "serial_number":      "VARCHAR(100)",
        "expiry_date":        "VARCHAR(10)",
        "unit_cost":          "DECIMAL(15,2)",
        "costing_method":     "VARCHAR(50)",
    }.items():
        _add_col_if_missing("inventory_stock_levels", col, defn)

    # 8. Add inventory_movement_history-specific columns ------------------
    for col, defn in {
        "stock_id":           "BIGINT",
        "movement_subtype":   "VARCHAR(50)",
        "quantity_before":    "INT",
        "quantity_changed":   "INT",
        "quantity_after":     "INT",
        "from_project_id":    "BIGINT",
        "to_project_id":      "BIGINT",
    }.items():
        _add_col_if_missing("inventory_movement_history", col, defn)

    # 9. Add system_error_log-specific columns ----------------------------
    for col, defn in {
        "error_category":    "VARCHAR(100)",
        "severity_level":    "VARCHAR(50)",
        "api_endpoint":      "VARCHAR(255)",
        "affected_table":    "VARCHAR(100)",
        "affected_record_id": "BIGINT",
        "error_timestamp":   "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
        "last_updated":      "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
        "resolved_by":       "BIGINT",
    }.items():
        _add_col_if_missing("system_error_log", col, defn)

    # 10. Add user_activity_log-specific columns --------------------------
    for col, defn in {
        "module_name":        "VARCHAR(100)",
        "page_url":           "VARCHAR(255)",
        "related_table":      "VARCHAR(100)",
        "related_record_id":  "BIGINT",
        "session_id":         "VARCHAR(100)",
        "activity_timestamp": "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()",
    }.items():
        _add_col_if_missing("user_activity_log", col, defn)

    # 11. Add user_accounts-specific columns ------------------------------
    for col, defn in {
        "username":       "VARCHAR(100) UNIQUE",
        "first_name":     "VARCHAR(100)",
        "last_name":      "VARCHAR(100)",
        "login_attempts": "INT DEFAULT 0",
        "last_login":     "VARCHAR(50)",
    }.items():
        _add_col_if_missing("user_accounts", col, defn)

    _safe_create_index("idx_user_accounts_username", "user_accounts", "username")

    # 12. Add inventory_products_master-specific columns ------------------
    for col, defn in {
        "product_code": "VARCHAR(100)",
        "unit_price":   "DECIMAL(15,2) DEFAULT 0",
        "currency":     "VARCHAR(3) DEFAULT 'INR'",
        "hsn_code":     "VARCHAR(20)",
        "lead_time_days": "INT DEFAULT 7",
        "is_active":    "BOOLEAN DEFAULT true",
    }.items():
        _add_col_if_missing("inventory_products_master", col, defn)

    # 13. Add civil_project_blocks-specific columns ----------------------
    for col, defn in {
        "completion_percentage": "DECIMAL(5,2) DEFAULT 0",
    }.items():
        _add_col_if_missing("civil_project_blocks", col, defn)

    # 14. Add civil_projects-specific columns ----------------------------
    for col, defn in {
        "customer_id":  "BIGINT",
        "total_budget": "DECIMAL(15,2)",
        "start_date":   "DATE",
        "end_date":     "DATE",
    }.items():
        _add_col_if_missing("civil_projects", col, defn)

    # 15. Create new tables not in original schema -----------------------

    # user_permissions_master
    if not _table_exists("user_permissions_master"):
        op.execute(
            """
            CREATE TABLE user_permissions_master (
                id              BIGSERIAL PRIMARY KEY,
                uuid            UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
                permission_name VARCHAR(100) UNIQUE NOT NULL,
                description     TEXT,
                module_name     VARCHAR(100),
                created_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                created_by      BIGINT,
                updated_by      BIGINT,
                is_deleted      BOOLEAN DEFAULT false NOT NULL,
                deleted_date    TIMESTAMP WITH TIME ZONE NULL,
                deleted_by      BIGINT
            );
            CREATE INDEX idx_user_permissions_master_name   ON user_permissions_master(permission_name);
            CREATE INDEX idx_user_permissions_master_module ON user_permissions_master(module_name);
            CREATE INDEX idx_user_permissions_master_uuid   ON user_permissions_master(uuid);
            """
        )

    # role_permission_assignments
    if not _table_exists("role_permission_assignments"):
        op.execute(
            """
            CREATE TABLE role_permission_assignments (
                id            BIGSERIAL PRIMARY KEY,
                uuid          UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
                role_id       BIGINT NOT NULL REFERENCES user_roles_master(id) ON DELETE CASCADE,
                permission_id BIGINT NOT NULL REFERENCES user_permissions_master(id) ON DELETE CASCADE,
                created_date  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                created_by    BIGINT,
                is_deleted    BOOLEAN DEFAULT false NOT NULL,
                deleted_date  TIMESTAMP WITH TIME ZONE NULL,
                deleted_by    BIGINT,
                UNIQUE(role_id, permission_id)
            );
            CREATE INDEX idx_role_perm_assignments_role_id ON role_permission_assignments(role_id);
            CREATE INDEX idx_role_perm_assignments_perm_id ON role_permission_assignments(permission_id);
            """
        )

    # project_user_assignments
    if not _table_exists("project_user_assignments"):
        op.execute(
            """
            CREATE TABLE project_user_assignments (
                id                    BIGSERIAL PRIMARY KEY,
                uuid                  UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
                user_id               BIGINT NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
                project_id            BIGINT REFERENCES civil_projects(id) ON DELETE CASCADE,
                block_id              BIGINT REFERENCES civil_project_blocks(id) ON DELETE CASCADE,
                assignment_start_date DATE,
                assignment_end_date   DATE,
                user_type             VARCHAR(100),
                created_date          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_date          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                created_by            BIGINT,
                updated_by            BIGINT,
                is_deleted            BOOLEAN DEFAULT false NOT NULL,
                deleted_date          TIMESTAMP WITH TIME ZONE NULL,
                deleted_by            BIGINT
            );
            CREATE INDEX idx_project_user_asgn_user_id    ON project_user_assignments(user_id);
            CREATE INDEX idx_project_user_asgn_project_id ON project_user_assignments(project_id);
            CREATE INDEX idx_project_user_asgn_block_id   ON project_user_assignments(block_id);
            """
        )

    # 16. Seed default roles -----------------------------------------------
    op.execute(
        """
        INSERT INTO user_roles_master (role_name, description)
        VALUES
            ('SUPER_ADMIN',     'Full system access'),
            ('ADMIN',           'Administrative functions'),
            ('PRIMARY_USER',    'Full operational access'),
            ('SECONDARY_USER',  'Limited operational access')
        ON CONFLICT (role_name) DO NOTHING;
        """
    )

    # 17. Create stored procedures (idempotent) ----------------------------
    op.execute(
        """
        CREATE OR REPLACE FUNCTION soft_delete_record(
            p_table_name    VARCHAR,
            p_id            BIGINT,
            p_deleted_by    BIGINT
        ) RETURNS void AS $$
        BEGIN
            EXECUTE format(
                'UPDATE %I SET is_deleted = true, is_active = false,
                 deleted_date = NOW(), deleted_by = $1 WHERE id = $2',
                p_table_name
            ) USING p_deleted_by, p_id;
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION restore_deleted_record(
            p_table_name VARCHAR,
            p_id         BIGINT
        ) RETURNS void AS $$
        BEGIN
            EXECUTE format(
                'UPDATE %I SET is_deleted = false, is_active = true,
                 deleted_date = NULL, deleted_by = NULL WHERE id = $1',
                p_table_name
            ) USING p_id;
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION log_audit_action(
            p_user_id    BIGINT,
            p_action     VARCHAR,
            p_table_name VARCHAR,
            p_record_id  BIGINT,
            p_old_values JSONB DEFAULT NULL,
            p_new_values JSONB DEFAULT NULL,
            p_status     VARCHAR DEFAULT 'SUCCESS'
        ) RETURNS void AS $$
        BEGIN
            INSERT INTO system_audit_trail (
                user_id, action_performed, table_name, record_id,
                old_values, new_values, action_status, action_timestamp
            ) VALUES (
                p_user_id, p_action, p_table_name, p_record_id,
                p_old_values, p_new_values, p_status, NOW()
            );
        END;
        $$ LANGUAGE plpgsql;

        CREATE OR REPLACE FUNCTION log_system_error(
            p_error_code       VARCHAR,
            p_error_category   VARCHAR,
            p_error_message    TEXT,
            p_error_stack_trace TEXT,
            p_service_name     VARCHAR,
            p_severity         VARCHAR,
            p_user_id          BIGINT DEFAULT NULL,
            p_function_name    VARCHAR DEFAULT NULL
        ) RETURNS BIGINT AS $$
        DECLARE v_id BIGINT;
        BEGIN
            INSERT INTO system_error_log (
                error_code, error_category, error_message, error_stack_trace,
                service_name, severity_level, user_id, function_name, error_timestamp
            ) VALUES (
                p_error_code, p_error_category, p_error_message, p_error_stack_trace,
                p_service_name, p_severity, p_user_id, p_function_name, NOW()
            ) RETURNING id INTO v_id;
            RETURN v_id;
        END;
        $$ LANGUAGE plpgsql;
        """
    )


# ---------------------------------------------------------------------------
# downgrade — reverses table renames; column/index changes are left in place
# ---------------------------------------------------------------------------

def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS log_system_error(VARCHAR,VARCHAR,TEXT,TEXT,VARCHAR,VARCHAR,BIGINT,VARCHAR);")
    op.execute("DROP FUNCTION IF EXISTS log_audit_action(BIGINT,VARCHAR,VARCHAR,BIGINT,JSONB,JSONB,VARCHAR);")
    op.execute("DROP FUNCTION IF EXISTS restore_deleted_record(VARCHAR,BIGINT);")
    op.execute("DROP FUNCTION IF EXISTS soft_delete_record(VARCHAR,BIGINT,BIGINT);")

    op.execute("DROP TABLE IF EXISTS project_user_assignments;")
    op.execute("DROP TABLE IF EXISTS role_permission_assignments;")
    op.execute("DROP TABLE IF EXISTS user_permissions_master;")

    reverse = [(new, old) for old, new in reversed(TABLE_RENAMES)]
    for old, new in reverse:
        _rename_table(old, new)
