import type { Options } from 'highcharts';
import { HC_COLORS, HC_FONT_FAMILY, HC_SERIES_COLORS } from './highcharts-design-tokens';

/**
 * Applied once via `provideHighcharts({ options })` — equivalent to `Highcharts.setOptions()`
 * in the official Highcharts + wrapper docs.
 *
 * Professional defaults:
 * - Clean axis lines with subtle ticks
 * - Dark semi-transparent tooltip with white text
 * - Colored-dot legend below the chart
 * - Smooth 500ms animations
 * - Crosshair on hover for precision
 * - Exporting / fullscreen enabled by default
 */
export const HIGHCHARTS_GLOBAL_OPTIONS: Options = {
  colors: [...HC_SERIES_COLORS],

  chart: {
    backgroundColor: 'transparent',
    reflow: true,
    animation: { duration: 500 },
    style: {
      fontFamily: HC_FONT_FAMILY,
    },
    spacing: [16, 20, 20, 16],
  },

  credits: { enabled: false },

  title: {
    align: 'left',
    style: {
      color: HC_COLORS.slate800,
      fontSize: '15px',
      fontWeight: '700',
      fontFamily: HC_FONT_FAMILY,
    },
  },

  subtitle: {
    align: 'left',
    style: {
      color: HC_COLORS.slate500,
      fontSize: '12px',
      fontWeight: '400',
      fontFamily: HC_FONT_FAMILY,
    },
  },

  /* ── Legend: dots below the chart ── */
  legend: {
    enabled: true,
    layout: 'horizontal',
    align: 'center',
    verticalAlign: 'bottom',
    floating: false,
    margin: 16,
    padding: 8,
    itemDistance: 20,
    symbolRadius: 5,
    symbolWidth: 10,
    symbolHeight: 10,
    itemStyle: {
      fontFamily: HC_FONT_FAMILY,
      color: HC_COLORS.slate600,
      fontWeight: '600',
      fontSize: '12px',
    },
    itemHoverStyle: {
      color: HC_COLORS.slate900,
    },
  },

  lang: {
    thousandsSep: ',',
    decimalPoint: '.',
    numericSymbols: ['k', 'M', 'B', 'T', 'P', 'E'],
  },

  /* ── Tooltip: dark glassmorphic style ── */
  tooltip: {
    useHTML: true,
    backgroundColor: HC_COLORS.tooltipBg,
    borderColor: 'transparent',
    borderRadius: 10,
    padding: 12,
    shadow: false,
    style: {
      fontFamily: HC_FONT_FAMILY,
      fontSize: '12px',
      color: '#FFFFFF',
    },
    headerFormat: '<span style="font-size:11px;font-weight:700;color:#CBD5E1;margin-bottom:4px;display:block">{point.key}</span>',
    pointFormat: '<span style="color:{point.color};font-size:10px">●</span> <span style="color:#CBD5E1">{series.name}:</span> <b style="color:#fff">{point.y}</b><br/>',
  },

  /* ── X-Axis: professional with subtle line ── */
  xAxis: {
    gridLineWidth: 0,
    lineColor: HC_COLORS.slate300,
    lineWidth: 1,
    tickColor: HC_COLORS.slate300,
    tickWidth: 1,
    tickLength: 6,
    crosshair: {
      color: 'rgba(37, 99, 235, 0.08)',
      width: 1,
      dashStyle: 'ShortDash',
    },
    labels: {
      style: {
        color: HC_COLORS.slate500,
        fontSize: '11px',
        fontFamily: HC_FONT_FAMILY,
      },
    },
    title: {
      style: {
        color: HC_COLORS.slate600,
        fontSize: '12px',
        fontWeight: '600',
        fontFamily: HC_FONT_FAMILY,
      },
    },
  },

  /* ── Y-Axis: clean gridlines, visible axis title ── */
  yAxis: {
    gridLineColor: HC_COLORS.grid,
    gridLineWidth: 1,
    gridLineDashStyle: 'Dot',
    lineColor: HC_COLORS.slate300,
    lineWidth: 1,
    tickColor: HC_COLORS.slate300,
    tickWidth: 1,
    tickLength: 6,
    labels: {
      style: {
        color: HC_COLORS.slate500,
        fontSize: '11px',
        fontFamily: HC_FONT_FAMILY,
      },
    },
    title: {
      style: {
        color: HC_COLORS.slate600,
        fontSize: '12px',
        fontWeight: '600',
        fontFamily: HC_FONT_FAMILY,
      },
    },
  },

  /* ── Plot options: smooth series ── */
  plotOptions: {
    series: {
      animation: { duration: 500 },
      states: {
        hover: {
          brightness: 0.05,
        },
        inactive: {
          opacity: 0.35,
        },
      },
    },
    column: {
      borderRadius: 4,
      borderWidth: 0,
      pointPadding: 0.1,
      groupPadding: 0.15,
    },
    line: {
      lineWidth: 2.5,
      marker: {
        radius: 4,
        symbol: 'circle',
        lineWidth: 2,
        lineColor: '#FFFFFF',
      },
    },
    scatter: {
      marker: {
        radius: 5,
        symbol: 'circle',
        lineWidth: 1,
        lineColor: 'rgba(255,255,255,0.6)',
        states: {
          hover: {
            radiusPlus: 3,
            lineWidthPlus: 0,
          },
        },
      },
    },
  },

  /* ── Exporting: built-in hamburger menu ── */
  exporting: {
    enabled: true,
    buttons: {
      contextButton: {
        menuItems: [
          'viewFullscreen',
          'separator',
          'downloadPNG',
          'downloadSVG',
          'downloadPDF',
        ],
        symbolStroke: HC_COLORS.slate400,
        symbolStrokeWidth: 2,
        theme: {
          fill: 'transparent',
        } as any,
      },
    },
  },
};
