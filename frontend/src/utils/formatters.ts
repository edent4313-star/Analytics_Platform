/**
 * Formatting utilities for numbers, dates, and strings used across widgets.
 */

/** Format a number with thousands separators and optional decimal places */
export function formatNumber(
  value: number | null | undefined,
  options: { decimals?: number; unit?: string } = {},
): string {
  if (value == null || isNaN(value)) return '—';
  const { decimals = 0, unit = '' } = options;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

/** Format as currency (ETB by default) */
export function formatCurrency(
  value: number | null | undefined,
  currency = 'ETB',
  decimals = 2,
): string {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Format as percentage */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value == null || isNaN(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

/** Format a date string as a readable date */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

/** Format a datetime string */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

/** Calculate percentage change between two values */
export function calcPercentChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Truncate a string to a max length */
export function truncate(str: string, maxLength = 50): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}…`;
}
