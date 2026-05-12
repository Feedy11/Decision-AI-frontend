import type { Options } from 'highcharts';
import { HC_COLORS, HC_FONT_FAMILY, HC_SERIES_COLORS } from './highcharts-design-tokens';

/**
 * Applied once via `provideHighcharts({ options })` — equivalent to `Highcharts.setOptions()`
 * in the official Highcharts + wrapper docs.
 */
export const HIGHCHARTS_GLOBAL_OPTIONS: Options = {
  colors: [...HC_SERIES_COLORS],
  chart: {
    backgroundColor: 'transparent',
    reflow: true,
    animation: { duration: 350 },
    style: {
      fontFamily: HC_FONT_FAMILY,
    },
  },
  credits: { enabled: false },
  title: {
    style: {
      color: HC_COLORS.slate600,
      fontSize: '13px',
      fontWeight: '700',
      fontFamily: HC_FONT_FAMILY,
    },
  },
  legend: {
    itemStyle: {
      fontFamily: HC_FONT_FAMILY,
      color: HC_COLORS.slate500,
      fontWeight: '600',
      fontSize: '11px',
    },
  },
  lang: {
    thousandsSep: ',',
    decimalPoint: '.',
    numericSymbols: ['k', 'M', 'B', 'T', 'P', 'E'],
  },
  tooltip: {
    useHTML: true,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderColor: HC_COLORS.border,
    borderRadius: 8,
    padding: 10,
    shadow: false,
    style: {
      fontFamily: HC_FONT_FAMILY,
      fontSize: '12px',
      color: HC_COLORS.slate600,
    },
  },
  xAxis: {
    gridLineColor: HC_COLORS.grid,
    lineColor: HC_COLORS.border,
    tickColor: HC_COLORS.border,
    labels: {
      style: {
        color: HC_COLORS.slate500,
        fontSize: '11px',
        fontFamily: HC_FONT_FAMILY,
      },
    },
    title: {
      style: {
        color: HC_COLORS.slate500,
        fontSize: '11px',
        fontFamily: HC_FONT_FAMILY,
      },
    },
  },
  yAxis: {
    gridLineColor: HC_COLORS.grid,
    lineColor: HC_COLORS.border,
    tickColor: HC_COLORS.border,
    labels: {
      style: {
        color: HC_COLORS.slate500,
        fontSize: '11px',
        fontFamily: HC_FONT_FAMILY,
      },
    },
    title: {
      style: {
        color: HC_COLORS.slate500,
        fontSize: '11px',
        fontFamily: HC_FONT_FAMILY,
      },
    },
  },
  plotOptions: {
    series: {
      animation: { duration: 350 },
      states: {
        hover: {
          brightness: 0.08,
        },
      },
    },
  },
};
