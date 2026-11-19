<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/money.php';

$cases = [
    [money_decimal_add('0.10', '0.20'), '0.30'],
    [money_decimal_add('-100.01', '0.02'), '-99.99'],
    [money_decimal_subtract('100.00', '0.01'), '99.99'],
    [money_decimal_subtract('0.00', '100.00'), '-100.00'],
    [money_decimal_multiply_quantity('0.20', 3), '0.60'],
    [money_decimal_multiply_quantity('999999999999.99', 4294967295), '4294967294999957050327.05'],
];

foreach ($cases as [$actual, $expected]) {
    if ($actual !== $expected) {
        throw new RuntimeException("Expected {$expected}; got {$actual}.");
    }
}

if (!money_decimal_is_positive('0.01')
    || money_decimal_is_positive('-0.01')
    || money_decimal_is_positive('0.00')) {
    throw new RuntimeException('Money positivity checks returned an incorrect result.');
}

echo "Money arithmetic tests passed.\n";
