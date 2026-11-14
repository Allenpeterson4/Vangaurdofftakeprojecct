<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function telegram_text(string $value): string
{
    return substr(str_replace(["\r", "\n"], ' ', trim($value)), 0, 180);
}

function queue_telegram_notification(PDO $connection, string $message): int
{
    $statement = $connection->prepare(
        'INSERT INTO `offtake_telegram_notifications` (`message_text`)
         VALUES (:message_text)'
    );
    $statement->execute(['message_text' => $message]);
    return (int)$connection->lastInsertId();
}

function deliver_telegram_notification(PDO $connection, int $notificationId): bool
{
    $connection->beginTransaction();
    try {
        $query = $connection->prepare(
            'SELECT `message_text`, `attempts`
             FROM `offtake_telegram_notifications`
             WHERE `id` = :id AND `delivery_status` = \'pending\'
             FOR UPDATE'
        );
        $query->execute(['id' => $notificationId]);
        $notification = $query->fetch();
        if (!is_array($notification)) {
            $connection->commit();
            return false;
        }

        $config = portal_config();
        $token = trim((string)($config['telegram_bot_token'] ?? ''));
        $chatId = trim((string)($config['telegram_chat_id'] ?? ''));
        $failure = '';
        if ($token === '' || $chatId === '' || str_starts_with($token, 'replace_with_') || str_starts_with($chatId, 'replace_with_')) {
            $failure = 'Telegram is not configured in api/config.php.';
        } elseif (!function_exists('curl_init')) {
            $failure = 'The PHP cURL extension is not enabled.';
        } else {
            $curl = curl_init('https://api.telegram.org/bot' . $token . '/sendMessage');
            if ($curl === false) {
                $failure = 'Unable to initialize the Telegram request.';
            } else {
                curl_setopt_array($curl, [
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => [
                        'chat_id' => $chatId,
                        'text' => (string)$notification['message_text'],
                        'disable_web_page_preview' => 'true',
                    ],
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_CONNECTTIMEOUT => 3,
                    CURLOPT_TIMEOUT => 6,
                    CURLOPT_SSL_VERIFYPEER => true,
                    CURLOPT_SSL_VERIFYHOST => 2,
                ]);
                $responseBody = curl_exec($curl);
                $httpStatus = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
                $curlError = curl_error($curl);
                curl_close($curl);

                if (!is_string($responseBody)) {
                    $failure = 'Telegram connection failed: ' . ($curlError !== '' ? $curlError : 'no response received.');
                } else {
                    $response = json_decode($responseBody, true);
                    if ($httpStatus < 200 || $httpStatus >= 300 || !is_array($response) || ($response['ok'] ?? false) !== true) {
                        $description = is_array($response) && is_string($response['description'] ?? null)
                            ? $response['description']
                            : 'Telegram returned an unsuccessful response.';
                        $failure = substr($description, 0, 450);
                    }
                }
            }
        }

        if ($failure === '') {
            $update = $connection->prepare(
                'UPDATE `offtake_telegram_notifications`
                 SET `delivery_status` = \'sent\',
                     `attempts` = `attempts` + 1,
                     `last_error` = NULL,
                     `sent_at` = UTC_TIMESTAMP(6)
                 WHERE `id` = :id'
            );
            $update->execute(['id' => $notificationId]);
            $connection->commit();
            return true;
        }

        $attempts = (int)$notification['attempts'] + 1;
        $update = $connection->prepare(
            'UPDATE `offtake_telegram_notifications`
             SET `delivery_status` = \'failed\',
                 `attempts` = :attempts,
                 `last_error` = :last_error
             WHERE `id` = :id'
        );
        $update->execute([
            'attempts' => $attempts,
            'last_error' => substr($failure, 0, 500),
            'id' => $notificationId,
        ]);
        $connection->commit();
        error_log('Telegram notification ' . $notificationId . ' could not be delivered: ' . $failure);
        return false;
    } catch (Throwable $error) {
        if ($connection->inTransaction()) $connection->rollBack();
        throw $error;
    }
}
