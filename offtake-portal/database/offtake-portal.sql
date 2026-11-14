-- Vanguard Offtake Portal schema for cPanel MySQL/MariaDB.
-- Use a dedicated database where possible. Table names are prefixed to avoid
-- collisions if this is installed beside the marketplace in a shared database.
-- Intended for MySQL 8.0.16+ or a compatible MariaDB version with generated
-- columns and CHECK constraints. Run once after creating the cPanel database.

CREATE TABLE IF NOT EXISTS `offtake_suppliers` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `contact_person` VARCHAR(160) NOT NULL DEFAULT '',
  `phone` VARCHAR(40) NOT NULL DEFAULT '',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `offtake_suppliers_name_idx` (`name`),
  CONSTRAINT `offtake_suppliers_name_check` CHECK (CHAR_LENGTH(TRIM(`name`)) BETWEEN 2 AND 160)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offtake_users` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `email` VARCHAR(320) NOT NULL,
  `full_name` VARCHAR(160) NOT NULL DEFAULT '',
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'manager') NOT NULL DEFAULT 'manager',
  `supplier_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `offtake_users_email_unique` (`email`),
  KEY `offtake_users_supplier_idx` (`supplier_id`),
  CONSTRAINT `offtake_users_supplier_fk`
    FOREIGN KEY (`supplier_id`) REFERENCES `offtake_suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offtake_batches` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `supplier_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `unit_quantity` INT UNSIGNED NOT NULL,
  `unit_cost_price` DECIMAL(14,2) NOT NULL,
  `unit_selling_price` DECIMAL(14,2) NOT NULL,
  `fuel_subsidy_per_unit` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `total_capital` DECIMAL(24,2) GENERATED ALWAYS AS (`unit_quantity` * `unit_cost_price`) STORED,
  `total_revenue` DECIMAL(24,2) GENERATED ALWAYS AS (`unit_quantity` * `unit_selling_price`) STORED,
  `net_investor_credit` DECIMAL(24,2) GENERATED ALWAYS AS
    (`unit_quantity` * (`unit_selling_price` - `fuel_subsidy_per_unit` - `unit_cost_price`)) STORED,
  `destination_route` VARCHAR(255) NOT NULL DEFAULT '',
  `vehicle_reference` VARCHAR(80) NOT NULL DEFAULT '',
  `driver_name` VARCHAR(160) NOT NULL DEFAULT '',
  `driver_phone` VARCHAR(40) NOT NULL DEFAULT '',
  `status` ENUM('pending', 'in_transit', 'completed', 'disputed') NOT NULL DEFAULT 'pending',
  `dispatched_at` DATETIME(6) DEFAULT NULL,
  `completed_at` DATETIME(6) DEFAULT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `offtake_batches_supplier_created_idx` (`supplier_id`, `created_at`),
  KEY `offtake_batches_status_completed_idx` (`status`, `completed_at`),
  CONSTRAINT `offtake_batches_supplier_fk`
    FOREIGN KEY (`supplier_id`) REFERENCES `offtake_suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `offtake_batches_quantity_check` CHECK (`unit_quantity` > 0),
  CONSTRAINT `offtake_batches_cost_check` CHECK (`unit_cost_price` >= 0),
  CONSTRAINT `offtake_batches_selling_check` CHECK (`unit_selling_price` >= 0),
  CONSTRAINT `offtake_batches_fuel_check` CHECK (`fuel_subsidy_per_unit` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offtake_status_audit` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `batch_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `old_status` ENUM('pending', 'in_transit', 'completed', 'disputed') DEFAULT NULL,
  `new_status` ENUM('pending', 'in_transit', 'completed', 'disputed') NOT NULL,
  `actor_user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `actor_email` VARCHAR(320) DEFAULT NULL,
  `occurred_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `offtake_audit_occurred_idx` (`occurred_at`, `id`),
  KEY `offtake_audit_batch_idx` (`batch_id`, `occurred_at`),
  CONSTRAINT `offtake_audit_batch_fk`
    FOREIGN KEY (`batch_id`) REFERENCES `offtake_batches` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `offtake_audit_actor_fk`
    FOREIGN KEY (`actor_user_id`) REFERENCES `offtake_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offtake_login_attempts` (
  `fingerprint` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `window_started` BIGINT UNSIGNED NOT NULL,
  `attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `blocked_until` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`fingerprint`),
  KEY `offtake_login_attempts_window_idx` (`window_started`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `offtake_telegram_notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_text` TEXT NOT NULL,
  `delivery_status` ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  `attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `last_error` VARCHAR(500) DEFAULT NULL,
  `next_attempt_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `sent_at` DATETIME(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `offtake_telegram_delivery_idx` (`delivery_status`, `next_attempt_at`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Register a normal account through /register, then replace the email below
-- with the platform owner's account to enable the first administrator:
-- UPDATE `offtake_users` SET `role` = 'admin', `supplier_id` = NULL
-- WHERE `email` = 'owner@example.com' AND `role` = 'manager';
