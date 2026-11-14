ALTER TABLE `offtake_telegram_notifications`
  MODIFY `delivery_status` ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending';

UPDATE `offtake_telegram_notifications`
SET `delivery_status` = 'failed'
WHERE `delivery_status` = 'pending';
