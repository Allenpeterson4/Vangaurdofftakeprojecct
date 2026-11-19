CREATE TABLE IF NOT EXISTS `offtake_weekly_payouts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `supplier_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `week_start` DATE NOT NULL,
  `amount` DECIMAL(24,2) NOT NULL,
  `paid_by_user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  `paid_by_email` VARCHAR(320) NOT NULL,
  `transfer_reference` VARCHAR(120) NOT NULL DEFAULT '',
  `paid_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `offtake_weekly_payouts_period_idx` (`supplier_id`, `week_start`, `paid_at`),
  CONSTRAINT `offtake_weekly_payouts_supplier_fk`
    FOREIGN KEY (`supplier_id`) REFERENCES `offtake_suppliers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `offtake_weekly_payouts_actor_fk`
    FOREIGN KEY (`paid_by_user_id`) REFERENCES `offtake_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `offtake_weekly_payouts_amount_check` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
