CREATE TABLE IF NOT EXISTS `offtake_telegram_notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_text` TEXT NOT NULL,
  `delivery_status` ENUM('pending', 'sent') NOT NULL DEFAULT 'pending',
  `attempts` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `last_error` VARCHAR(500) DEFAULT NULL,
  `next_attempt_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `sent_at` DATETIME(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `offtake_telegram_delivery_idx` (`delivery_status`, `next_attempt_at`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
