export function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  const currency = process.env.NEXT_PUBLIC_CURRENCY || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function dateTime(value: string | null | undefined) {
  if (!value) return '—';
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
