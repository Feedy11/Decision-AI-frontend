import type Highcharts from 'highcharts';

/** Safe text for `tooltip.useHTML` string concatenation. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Short axis labels: 1380000 → 1.38M (per product requirement).
 */
export function formatAxisValueShort(value: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '';
  }
  const sign = value < 0 ? '−' : '';
  const v = Math.abs(value);
  if (v >= 1e12) {
    return sign + trimTrailingZeros(v / 1e12) + 'T';
  }
  if (v >= 1e9) {
    return sign + trimTrailingZeros(v / 1e9) + 'B';
  }
  if (v >= 1e6) {
    return sign + trimTrailingZeros(v / 1e6) + 'M';
  }
  if (v >= 1e3) {
    return sign + trimTrailingZeros(v / 1e3) + 'K';
  }
  if (v >= 1) {
    return sign + Math.round(v).toLocaleString('en-US');
  }
  return sign + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function trimTrailingZeros(n: number): string {
  const s = n.toFixed(2).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

/** Tooltips: full grouping with thousands separators (1,380,000). */
export function formatTooltipNumber(
  value: number,
  decimals = 2
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '';
  }
  const d = Number.isInteger(value) && Math.abs(value) >= 1000 ? 0 : decimals;
  const parts = value.toFixed(d).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}
