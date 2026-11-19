-- MySQL reference schema matching the current Supabase off-take table shape.
-- This does not replace the Supabase backend, Auth, triggers, or row-level
-- security. The deployed portal continues to use Supabase exclusively.
--
-- Run in a new cPanel MySQL 8.0.16+ database only if a separate MySQL copy of
-- the operational data is required. No live database is dropped or modified.
-- Supabase Auth user IDs are stored as UUID values; Auth credentials and
-- auth.users are managed by Supabase and are intentionally not recreated here.

CREATE TABLE IF NOT EXISTS `offtake_v2_suppliers` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `contact_person` VARCHAR(160) NOT NULL DEFAULT '',
  `phone` VARCHAR(40) NOT NULL DEFAULT '',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `offtake_v2_suppliers_name_idx` (`name`),
  CONSTRAINT `offtake_v2_suppliers_name_check`
    CHECK (CHAR_LENGTH(TRIM(`name`)) BETWEEN 2 AND 160)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offtake_v2_managers` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `email` VARCHAR(320) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `full_name` VARCHAR(160) NOT NULL,
  `supplier_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `offtake_v2_managers_email_key` (`email`),
  KEY `offtake_v2_managers_supplier_idx` (`supplier_id`, `is_active`),
  CONSTRAINT `offtake_v2_managers_full_name_check`
    CHECK (CHAR_LENGTH(TRIM(`full_name`)) BETWEEN 2 AND 160),
  CONSTRAINT `offtake_v2_managers_supplier_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `offtake_v2_suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offtake_v2_admins` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `email` VARCHAR(320) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `full_name` VARCHAR(160) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `offtake_v2_admins_email_key` (`email`),
  CONSTRAINT `offtake_v2_admins_full_name_check`
    CHECK (CHAR_LENGTH(TRIM(`full_name`)) BETWEEN 2 AND 160)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offtake_v2_manager_suppliers` (
  `manager_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `supplier_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `assigned_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`manager_id`, `supplier_id`),
  KEY `offtake_v2_manager_suppliers_supplier_idx` (`supplier_id`, `manager_id`),
  CONSTRAINT `offtake_v2_manager_suppliers_manager_fkey`
    FOREIGN KEY (`manager_id`) REFERENCES `offtake_v2_managers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `offtake_v2_manager_suppliers_supplier_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `offtake_v2_suppliers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offtake_v2_batches` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `supplier_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `accounting_model` VARCHAR(16) NOT NULL DEFAULT 'legacy',
  `product_name` VARCHAR(160) NOT NULL DEFAULT '',
  `unit_quantity` BIGINT NOT NULL,
  `unit_cost_price` DECIMAL(14,2) NOT NULL,
  `unit_selling_price` DECIMAL(14,2) NOT NULL,
  `fuel_subsidy_per_unit` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `total_capital` DECIMAL(24,2)
    GENERATED ALWAYS AS (`unit_quantity` * `unit_cost_price`) STORED,
  `total_revenue` DECIMAL(24,2)
    GENERATED ALWAYS AS (`unit_quantity` * `unit_selling_price`) STORED,
  `net_investor_credit` DECIMAL(24,2)
    GENERATED ALWAYS AS (
      `unit_quantity` * (`unit_selling_price` - `fuel_subsidy_per_unit` - `unit_cost_price`)
    ) STORED,
  `initial_purchase_amount` DECIMAL(24,2) NOT NULL DEFAULT 0,
  `sales_discount_percent` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `wholesale_supply_price` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `manager_allowance_percent` DECIMAL(5,2) NOT NULL DEFAULT 15,
  `discounted_revenue` DECIMAL(24,2)
    GENERATED ALWAYS AS (
      ROUND(`unit_quantity` * `wholesale_supply_price` * (100 - `sales_discount_percent`) / 100, 2)
    ) STORED,
  `gross_profit` DECIMAL(24,2)
    GENERATED ALWAYS AS (
      ROUND(`unit_quantity` * `wholesale_supply_price` * (100 - `sales_discount_percent`) / 100, 2)
        - `initial_purchase_amount`
    ) STORED,
  `manager_allowance_amount` DECIMAL(24,2)
    GENERATED ALWAYS AS (
      ROUND(
        GREATEST(
          ROUND(`unit_quantity` * `wholesale_supply_price` * (100 - `sales_discount_percent`) / 100, 2)
            - `initial_purchase_amount`,
          0
        ) * `manager_allowance_percent` / 100,
        2
      )
    ) STORED,
  `net_company_payout` DECIMAL(24,2)
    GENERATED ALWAYS AS (
      GREATEST(
        ROUND(`unit_quantity` * `wholesale_supply_price` * (100 - `sales_discount_percent`) / 100, 2)
          - ROUND(
            GREATEST(
              ROUND(`unit_quantity` * `wholesale_supply_price` * (100 - `sales_discount_percent`) / 100, 2)
                - `initial_purchase_amount`,
              0
            ) * `manager_allowance_percent` / 100,
            2
          ),
        0
      )
    ) STORED,
  `destination_route` VARCHAR(255) NOT NULL DEFAULT '',
  `vehicle_reference` VARCHAR(80) NOT NULL DEFAULT '',
  `driver_name` VARCHAR(160) NOT NULL DEFAULT '',
  `driver_phone` VARCHAR(40) NOT NULL DEFAULT '',
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `dispatched_at` DATETIME(6) DEFAULT NULL,
  `completed_at` DATETIME(6) DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `offtake_v2_batches_supplier_created_idx` (`supplier_id`, `created_at`),
  KEY `offtake_v2_batches_status_completed_idx` (`status`, `completed_at`),
  CONSTRAINT `offtake_v2_batches_supplier_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `offtake_v2_suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `offtake_v2_batches_accounting_model_check`
    CHECK (`accounting_model` IN ('legacy', 'inventory')),
  CONSTRAINT `offtake_v2_batches_product_name_check`
    CHECK (CHAR_LENGTH(TRIM(`product_name`)) <= 160),
  CONSTRAINT `offtake_v2_batches_quantity_check` CHECK (`unit_quantity` > 0),
  CONSTRAINT `offtake_v2_batches_cost_check` CHECK (`unit_cost_price` >= 0),
  CONSTRAINT `offtake_v2_batches_selling_check` CHECK (`unit_selling_price` >= 0),
  CONSTRAINT `offtake_v2_batches_fuel_check` CHECK (`fuel_subsidy_per_unit` >= 0),
  CONSTRAINT `offtake_v2_batches_purchase_amount_check` CHECK (`initial_purchase_amount` >= 0),
  CONSTRAINT `offtake_v2_batches_discount_check` CHECK (`sales_discount_percent` BETWEEN 0 AND 100),
  CONSTRAINT `offtake_v2_batches_wholesale_price_check` CHECK (`wholesale_supply_price` >= 0),
  CONSTRAINT `offtake_v2_batches_allowance_percent_check` CHECK (`manager_allowance_percent` BETWEEN 0 AND 100),
  CONSTRAINT `offtake_v2_batches_status_check`
    CHECK (`status` IN ('pending', 'paid', 'in_transit', 'completed', 'disputed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offtake_v2_status_audit` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `batch_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `old_status` VARCHAR(16) DEFAULT NULL,
  `new_status` VARCHAR(16) NOT NULL,
  `actor_role` VARCHAR(8) NOT NULL,
  `actor_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `actor_email` VARCHAR(320) NOT NULL,
  `occurred_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `offtake_v2_audit_occurred_idx` (`occurred_at`, `id`),
  KEY `offtake_v2_audit_batch_idx` (`batch_id`, `occurred_at`),
  CONSTRAINT `offtake_v2_status_audit_batch_fkey`
    FOREIGN KEY (`batch_id`) REFERENCES `offtake_v2_batches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `offtake_v2_status_audit_actor_role_check`
    CHECK (`actor_role` IN ('admin', 'manager')),
  CONSTRAINT `offtake_v2_status_audit_old_status_check`
    CHECK (`old_status` IS NULL OR `old_status` IN ('pending', 'paid', 'in_transit', 'completed', 'disputed')),
  CONSTRAINT `offtake_v2_status_audit_new_status_check`
    CHECK (`new_status` IN ('pending', 'paid', 'in_transit', 'completed', 'disputed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offtake_v2_weekly_payouts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `supplier_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `week_start` DATE NOT NULL,
  `amount` DECIMAL(24,2) NOT NULL,
  `paid_by_admin_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `paid_by_email` VARCHAR(320) NOT NULL,
  `transfer_reference` VARCHAR(120) NOT NULL DEFAULT '',
  `paid_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `offtake_v2_payouts_period_idx` (`supplier_id`, `week_start`, `paid_at`),
  CONSTRAINT `offtake_v2_weekly_payouts_supplier_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `offtake_v2_suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `offtake_v2_weekly_payouts_admin_fkey`
    FOREIGN KEY (`paid_by_admin_id`) REFERENCES `offtake_v2_admins` (`id`) ON DELETE SET NULL,
  CONSTRAINT `offtake_v2_weekly_payouts_amount_check` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- This schema mirrors table structure and arithmetic only. Supabase owns
-- auth.users, password credentials, RLS policies, signup triggers, protected
-- status-transition logic, and the weekly-payout RPC. The current portal does
-- not read or write these MySQL tables.
