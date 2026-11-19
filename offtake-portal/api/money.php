<?php
declare(strict_types=1);

function money_decimal_add(string $left, string $right): string
{
    $leftMinor = money_decimal_to_minor($left);
    $rightMinor = money_decimal_to_minor($right);
    $leftNegative = str_starts_with($leftMinor, '-');
    $rightNegative = str_starts_with($rightMinor, '-');
    $leftMagnitude = $leftNegative ? substr($leftMinor, 1) : $leftMinor;
    $rightMagnitude = $rightNegative ? substr($rightMinor, 1) : $rightMinor;

    if ($leftNegative === $rightNegative) {
        $magnitude = unsigned_integer_add($leftMagnitude, $rightMagnitude);
        return minor_to_money(($leftNegative && $magnitude !== '0' ? '-' : '') . $magnitude);
    }

    $comparison = unsigned_integer_compare($leftMagnitude, $rightMagnitude);
    if ($comparison === 0) return '0.00';
    $leftIsLarger = $comparison > 0;
    $magnitude = $leftIsLarger
        ? unsigned_integer_subtract($leftMagnitude, $rightMagnitude)
        : unsigned_integer_subtract($rightMagnitude, $leftMagnitude);
    $negative = $leftIsLarger ? $leftNegative : $rightNegative;
    return minor_to_money(($negative ? '-' : '') . $magnitude);
}

function money_decimal_subtract(string $left, string $right): string
{
    $rightMinor = money_decimal_to_minor($right);
    $negated = str_starts_with($rightMinor, '-') ? substr($rightMinor, 1) : '-' . $rightMinor;
    return money_decimal_add($left, minor_to_money($negated));
}

function money_decimal_is_positive(string $value): bool
{
    $minor = money_decimal_to_minor($value);
    return !str_starts_with($minor, '-') && $minor !== '0';
}

function money_decimal_multiply_quantity(string $amount, int $quantity): string
{
    if ($quantity < 0) throw new InvalidArgumentException('A financial quantity cannot be negative.');
    $minor = money_decimal_to_minor($amount);
    $negative = str_starts_with($minor, '-');
    $magnitude = $negative ? substr($minor, 1) : $minor;
    $product = unsigned_integer_multiply($magnitude, (string)$quantity);
    return minor_to_money(($negative && $product !== '0' ? '-' : '') . $product);
}

function money_decimal_to_minor(string $value): string
{
    if (!preg_match('/^(-?)([0-9]+)(?:\.([0-9]{1,2}))?$/', trim($value), $matches)) {
        throw new RuntimeException('The database returned an invalid decimal money value.');
    }
    $magnitude = ltrim($matches[2] . str_pad($matches[3] ?? '', 2, '0'), '0');
    if ($magnitude === '') $magnitude = '0';
    return $matches[1] === '-' && $magnitude !== '0' ? '-' . $magnitude : $magnitude;
}

function minor_to_money(string $minor): string
{
    $negative = str_starts_with($minor, '-');
    $magnitude = ltrim($negative ? substr($minor, 1) : $minor, '0');
    if ($magnitude === '') $magnitude = '0';
    $magnitude = str_pad($magnitude, 3, '0', STR_PAD_LEFT);
    $whole = substr($magnitude, 0, -2);
    $fraction = substr($magnitude, -2);
    return ($negative && $magnitude !== '000' ? '-' : '') . $whole . '.' . $fraction;
}

function unsigned_integer_compare(string $left, string $right): int
{
    $left = ltrim($left, '0') ?: '0';
    $right = ltrim($right, '0') ?: '0';
    return (strlen($left) <=> strlen($right)) ?: strcmp($left, $right);
}

function unsigned_integer_add(string $left, string $right): string
{
    $leftIndex = strlen($left) - 1;
    $rightIndex = strlen($right) - 1;
    $carry = 0;
    $result = '';
    while ($leftIndex >= 0 || $rightIndex >= 0 || $carry > 0) {
        $sum = $carry
            + ($leftIndex >= 0 ? (int)$left[$leftIndex--] : 0)
            + ($rightIndex >= 0 ? (int)$right[$rightIndex--] : 0);
        $result = (string)($sum % 10) . $result;
        $carry = intdiv($sum, 10);
    }
    return ltrim($result, '0') ?: '0';
}

function unsigned_integer_subtract(string $larger, string $smaller): string
{
    $largerIndex = strlen($larger) - 1;
    $smallerIndex = strlen($smaller) - 1;
    $borrow = 0;
    $result = '';
    while ($largerIndex >= 0) {
        $digit = (int)$larger[$largerIndex--] - $borrow
            - ($smallerIndex >= 0 ? (int)$smaller[$smallerIndex--] : 0);
        $borrow = $digit < 0 ? 1 : 0;
        if ($borrow) $digit += 10;
        $result = (string)$digit . $result;
    }
    return ltrim($result, '0') ?: '0';
}

function unsigned_integer_multiply(string $left, string $right): string
{
    $left = ltrim($left, '0') ?: '0';
    $right = ltrim($right, '0') ?: '0';
    if ($left === '0' || $right === '0') return '0';
    $leftLength = strlen($left);
    $rightLength = strlen($right);
    $digits = array_fill(0, $leftLength + $rightLength, 0);
    for ($leftIndex = $leftLength - 1; $leftIndex >= 0; $leftIndex--) {
        for ($rightIndex = $rightLength - 1; $rightIndex >= 0; $rightIndex--) {
            $position = $leftIndex + $rightIndex + 1;
            $product = (int)$left[$leftIndex] * (int)$right[$rightIndex] + $digits[$position];
            $digits[$position] = $product % 10;
            $digits[$position - 1] += intdiv($product, 10);
        }
    }
    return ltrim(implode('', $digits), '0') ?: '0';
}
