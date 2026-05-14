/**
 * Design tokens aligned with dashboard / Material app (Inter, slate palette, brand blues).
 * Extended palette for professional multi-series charts.
 */
export const HC_FONT_FAMILY = `'Inter', 'Segoe UI', Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif`;

export const HC_COLORS = {
  primary   : '#2563EB',
  secondary : '#7C3AED',
  positive  : '#10B981',
  warning   : '#F59E0B',
  danger    : '#EF4444',
  cyan      : '#06B6D4',
  rose      : '#F43F5E',
  amber     : '#D97706',
  indigo    : '#6366F1',
  teal      : '#14B8A6',
  slate900  : '#0F172A',
  slate800  : '#1E293B',
  slate700  : '#334155',
  slate600  : '#475569',
  slate500  : '#64748B',
  slate400  : '#94A3B8',
  slate300  : '#CBD5E1',
  border    : '#E2E8F0',
  grid      : '#F1F5F9',
  surface   : '#FFFFFF',
  tooltipBg : 'rgba(15, 23, 42, 0.95)',
} as const;

/** Series / plot palette — vibrant, accessible, and distinguishable in both light & dark. */
export const HC_SERIES_COLORS: string[] = [
  '#2563EB',   // Blue
  '#7C3AED',   // Violet
  '#10B981',   // Emerald
  '#F59E0B',   // Amber
  '#EF4444',   // Red
  '#06B6D4',   // Cyan
  '#F43F5E',   // Rose
  '#6366F1',   // Indigo
  '#14B8A6',   // Teal
  '#D97706',   // Dark Amber
];
