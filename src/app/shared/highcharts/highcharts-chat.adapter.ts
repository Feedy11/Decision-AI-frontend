import type { Options, PointOptionsObject } from 'highcharts';
import Highcharts from 'highcharts';
import type { ChartSpec } from '../../models/chat.model';
import { HC_COLORS, HC_SERIES_COLORS } from './highcharts-design-tokens';
import { escapeHtml, formatAxisValueShort, formatTooltipNumber } from './highcharts-number-format';

function axisLabelFormatter(this: Highcharts.AxisLabelsFormatterContextObject): string {
  const v = this.value;
  if (typeof v === 'string') {
    return v.length > 22 ? v.slice(0, 20) + '…' : v;
  }
  if (typeof v === 'number') {
    return formatAxisValueShort(v);
  }
  return String(v ?? '');
}

/**
 * Build professional Highcharts options from a chat ChartSpec.
 * Mirrors the dashboard adapter's premium styling.
 */
export function buildChatChartOptions(spec: ChartSpec): Options {
  const titleText = spec.title || 'Graphique';
  const d = spec.data;
  const hasData =
    d &&
    Array.isArray(d['axis_x']) &&
    d['axis_x'].length > 0 &&
    (Array.isArray(d['axis_y']) ||
      (Array.isArray(d['series']) && (d['series'] as unknown[]).length > 0));
  const multiSeries =
    hasData &&
    Array.isArray(d!['series']) &&
    (d!['series'] as { name: string; values: number[] }[]).length > 0;

  const baseTitle: Options['title'] = {
    text: titleText,
    align: 'left',
    margin: 14,
  };

  /** Build a subtitle from column info */
  const subtitleParts: string[] = [];
  if (spec.x_col) subtitleParts.push(spec.x_col);
  if (spec.y_col) subtitleParts.push(spec.y_col);
  const baseSubtitle: Options['subtitle'] = subtitleParts.length > 0
    ? { text: subtitleParts.join(' × '), align: 'left' }
    : undefined;

  const tooltipDecimals = (y: number) => (Number.isFinite(y) && Math.abs(y) >= 1000 ? 0 : 2);

  /* ═══ PIE ═══ */
  if (spec.chart_type === 'pie') {
    const xs: string[] = hasData ? (d!['axis_x'] as string[]).map(String) : [];
    const ys: number[] = hasData ? (d!['axis_y'] as number[]).map(Number) : [];
    const pieData: PointOptionsObject[] = xs.map((name, i) => ({
      name,
      y: ys[i] ?? 0,
      color: HC_SERIES_COLORS[i % HC_SERIES_COLORS.length],
    }));

    return {
      chart: { type: 'pie' },
      title: baseTitle,
      subtitle: baseSubtitle,
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          borderRadius: 4,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          dataLabels: {
            enabled: true,
            format: '<b>{point.name}</b>: {point.percentage:.1f} %',
            style: {
              fontSize: '10px',
              fontWeight: '600',
              color: HC_COLORS.slate600,
              textOutline: 'none',
            },
          },
          showInLegend: true,
        },
      },
      legend: {
        enabled: true,
        verticalAlign: 'bottom',
        align: 'center',
      },
      tooltip: {
        pointFormatter(this: Highcharts.Point) {
          const y = Number(this.y);
          return (
            `<span style="color:${this.color};font-size:12px">●</span> ` +
            `<span style="color:#CBD5E1">${escapeHtml(String(this.name))}:</span> ` +
            `<b style="color:#fff">${formatTooltipNumber(Highcharts, y, tooltipDecimals(y))}</b> ` +
            `<span style="color:#94A3B8">(${this.percentage?.toFixed(1)}%)</span>`
          );
        },
      },
      series: [{ type: 'pie', name: spec.y_col || 'Valeur', data: pieData, colors: HC_SERIES_COLORS }],
    };
  }

  /* ═══ HEATMAP ═══ */
  if (spec.chart_type === 'heatmap') {
    const dx = spec.data ?? {};
    const labelsX: string[] = (dx['labels_x'] as string[]) ?? [];
    const labelsY: string[] = (dx['labels_y'] as string[]) ?? [];
    const matrix: (number | null)[][] = (dx['matrix'] as (number | null)[][]) ?? [];
    const heatData: [number, number, number][] = [];
    let min = Infinity;
    let max = -Infinity;
    labelsY.forEach((_, yi) => {
      const row = matrix[yi] ?? [];
      labelsX.forEach((_, xi) => {
        const rawVal = row[xi];
        const val = rawVal === null || rawVal === undefined || !Number.isFinite(rawVal) ? 0 : rawVal;
        if (val < min) {
          min = val;
        }
        if (val > max) {
          max = val;
        }
        heatData.push([xi, yi, val]);
      });
    });
    if (!Number.isFinite(min)) {
      min = 0;
    }
    if (!Number.isFinite(max)) {
      max = 0;
    }
    const cmax = max === min ? min + 1e-9 : max;

    return {
      chart: { type: 'heatmap' },
      title: baseTitle,
      subtitle: baseSubtitle,
      colorAxis: {
        min,
        max: cmax,
        minColor: '#F0F4FF',
        maxColor: HC_COLORS.primary,
        labels: {
          style: { color: HC_COLORS.slate500, fontSize: '11px' },
        },
      },
      xAxis: {
        type: 'category',
        categories: labelsX,
        title: spec.x_col ? { text: spec.x_col } : undefined,
      },
      yAxis: {
        type: 'category',
        categories: labelsY,
        title: spec.y_col ? { text: spec.y_col } : undefined,
        reversed: true,
      },
      legend: {
        enabled: true,
        verticalAlign: 'bottom',
        align: 'center',
      },
      tooltip: {
        formatter(this: Highcharts.Point) {
          const xIdx = Number(this.x);
          const yIdx = Number(this.y);
          const lx = labelsX[xIdx] ?? String(this.x);
          const ly = labelsY[yIdx] ?? String(this.y);
          const val = Number(this.value);
          return (
            `<div style="padding:2px 0"><span style="color:#CBD5E1;font-size:11px;font-weight:600">${escapeHtml(String(ly))} × ${escapeHtml(String(lx))}</span></div>` +
            `<div><span style="color:#CBD5E1">Valeur:</span> <b style="color:#fff">${formatTooltipNumber(Highcharts, val, tooltipDecimals(val))}</b></div>`
          );
        },
      },
      series: [
        {
          type: 'heatmap',
          name: spec.y_col || 'Intensité',
          borderWidth: 1,
          borderColor: '#FFFFFF',
          data: heatData,
        },
      ],
    };
  }

  /* ═══ SCATTER ═══ */
  if (spec.chart_type === 'scatter') {
    const xs = (hasData ? d!['axis_x'] : []) as number[];
    const ys = (hasData ? d!['axis_y'] : []) as number[];
    const pts = xs
      .map((x, i) => [x, ys[i] ?? NaN] as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

    return {
      chart: { type: 'scatter', zooming: { type: 'xy' } },
      title: baseTitle,
      subtitle: baseSubtitle,
      xAxis: {
        type: 'linear',
        title: spec.x_col ? { text: spec.x_col } : undefined,
        labels: { formatter: axisLabelFormatter },
        gridLineWidth: 1,
        gridLineDashStyle: 'Dot',
        gridLineColor: HC_COLORS.grid,
      },
      yAxis: {
        type: 'linear',
        title: spec.y_col ? { text: spec.y_col } : undefined,
        labels: { formatter: axisLabelFormatter },
      },
      legend: {
        enabled: true,
        verticalAlign: 'bottom',
        align: 'center',
      },
      tooltip: {
        formatter(this: Highcharts.Point) {
          const px = Number(this.x);
          const py = Number(this.y);
          return (
            `<div style="padding:2px 0"><span style="color:${this.color};font-size:12px">●</span> <b style="color:#fff">${escapeHtml(this.series?.name || '')}</b></div>` +
            `<div><span style="color:#CBD5E1">${escapeHtml(spec.x_col || 'X')}:</span> <b style="color:#fff">${formatTooltipNumber(Highcharts, px, tooltipDecimals(px))}</b></div>` +
            `<div><span style="color:#CBD5E1">${escapeHtml(spec.y_col || 'Y')}:</span> <b style="color:#fff">${formatTooltipNumber(Highcharts, py, tooltipDecimals(py))}</b></div>`
          );
        },
      },
      series: [
        {
          type: 'scatter',
          name: spec.y_col || 'Série',
          color: HC_SERIES_COLORS[0],
          data: pts,
        },
      ],
    };
  }

  /* ═══ COLUMN / LINE / BAR ═══ */
  const chartType =
    spec.chart_type === 'line'
      ? 'line'
      : spec.chart_type === 'bar' || spec.chart_type === 'histogram'
        ? 'column'
        : 'column';
  const categories = hasData ? (d!['axis_x'] as (string | number)[]).map(String) : [];
  const values = hasData && Array.isArray(d!['axis_y']) ? (d!['axis_y'] as number[]) : [];

  const hcSeries: Highcharts.SeriesOptionsType[] = multiSeries
    ? (d!['series'] as { name: string; values: number[] }[]).map((s, i) => ({
        type: chartType,
        name: s.name,
        data: s.values as (number | null | PointOptionsObject)[],
        color: HC_SERIES_COLORS[i % HC_SERIES_COLORS.length],
      }))
    : [
        {
          type: chartType,
          name: spec.y_col || 'Valeur',
          data: values as (number | null | PointOptionsObject)[],
          color: HC_SERIES_COLORS[0],
        },
      ];

  return {
    chart: { type: chartType },
    title: baseTitle,
    subtitle: baseSubtitle,
    xAxis: {
      type: 'category',
      categories,
      title: spec.x_col ? { text: spec.x_col } : undefined,
      crosshair: chartType === 'column' ? { color: 'rgba(37, 99, 235, 0.06)', width: 1 } : undefined,
    },
    yAxis: {
      title: spec.y_col ? { text: spec.y_col } : undefined,
      labels: { formatter: axisLabelFormatter },
    },
    legend: {
      enabled: true,
      verticalAlign: 'bottom',
      align: 'center',
    },
    plotOptions: {
      column: {
        borderRadius: 5,
        borderWidth: 0,
        colorByPoint: !multiSeries && categories.length <= 12,
        colors: HC_SERIES_COLORS,
        dataLabels: { enabled: false },
      },
      line: {
        lineWidth: 2.5,
        marker: { radius: 4, symbol: 'circle', lineWidth: 2, lineColor: '#FFFFFF' },
      },
    },
    tooltip: {
      formatter(this: Highcharts.Point) {
        const y = Number(this.y);
        const name = this.series?.name || spec.y_col || 'Valeur';
        const cat = this.category ?? this.x;
        const dotColor = this.color || HC_SERIES_COLORS[0];
        return (
          `<div style="padding:2px 0"><span style="color:#CBD5E1;font-size:11px;font-weight:600">${escapeHtml(String(cat))}</span></div>` +
          `<div><span style="color:${dotColor};font-size:12px">●</span> <span style="color:#CBD5E1">${escapeHtml(String(name))}:</span> <b style="color:#fff">${formatTooltipNumber(Highcharts, y, tooltipDecimals(y))}</b></div>`
        );
      },
    },
    series: hcSeries,
  };
}
