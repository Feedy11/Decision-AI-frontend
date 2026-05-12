/**
 * Design tokens aligned with dashboard / Material app (Roboto, slate palette, brand blues).
 */
export const HC_FONT_FAMILY = `Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif`;

export const HC_COLORS = {
  primary   : '#2563EB',
  secondary : '#7C3AED',
  positive  : '#22C55E',
  warning   : '#F59E0B',
  danger    : '#EF4444',
  slate600  : '#475569',
  slate500  : '#64748B',
  slate400  : '#94A3B8',
  border    : '#E2E8F0',
  grid      : '#F1F5F9',
  surface   : '#FFFFFF',
} as const;

/** Series / plot palette (matches prior Apex usage on dashboard). */
export const HC_SERIES_COLORS: string[] = [
  HC_COLORS.primary,
  HC_COLORS.secondary,
  HC_COLORS.positive,
  HC_COLORS.warning,
  HC_COLORS.danger,
  '#06B6D4',
];
