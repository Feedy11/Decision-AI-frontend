import type { Options, PointOptionsObject } from 'highcharts';
import type Highcharts from 'highcharts';
import type { ChartDataResponse } from '../../models/Dashboard.model';
import { HC_COLORS, HC_SERIES_COLORS } from './highcharts-design-tokens';
import { escapeHtml, formatAxisValueShort, formatTooltipNumber } from './highcharts-number-format';

function axisLabelFormatter(this: Highcharts.AxisLabelsFormatterContextObject): string {
  const v = this.value;
  if (typeof v === 'string') {
    return v.length > 24 ? v.slice(0, 22) + '…' : v;
  }
  if (typeof v === 'number') {
    return formatAxisValueShort(v);
  }
  return String(v ?? '');
}

function normalizeDashboardKind(data: ChartDataResponse): 'heatmap' | 'scatter' | 'line' | 'column' | 'pie' | 'bar' {
  const raw = `${data.chart_title} ${data.aggregation ?? ''}`.toLowerCase();
  if (raw.includes('pie') || raw.includes('donut') || raw.includes('camembert')) {
    return 'pie';
  }
  if (raw.includes('scatter')) {
    return 'scatter';
  }
  if (raw.includes('heat') || raw.includes('crosstab')) {
    return 'heatmap';
  }
  if (raw.includes('line') || raw.includes('trend') || raw.includes('evolution') || raw.includes('temporal')) {
    return 'line';
  }
  if (raw.includes('bar') || raw.includes('horizontal')) {
    return 'bar';
  }
  return 'column';
}

/**
 * Build professional Highcharts options from a dashboard chart data response.
 * Features:
 * - Professional axis titles (bold, visible) with axis lines & ticks
 * - Centered bottom legend with colored dots for each series
 * - Dark tooltip with series color indicators
 * - Smooth animations and crosshair
 * - Exporting / fullscreen via hamburger menu (global)
 */
export function buildDashboardChartOptions(data: ChartDataResponse): Options {
  const kind = normalizeDashboardKind(data);
  const titleText = data.chart_title;
  const d = data.data ?? {};

  const baseTitle: Options['title'] = {
    text: undefined,
  };

  /** Build a subtitle from axes info */
  const subtitleParts: string[] = [];
  if (data.x_axis) subtitleParts.push(data.x_axis);
  if (data.y_axis) subtitleParts.push(data.y_axis);
  const baseSubtitle: Options['subtitle'] = undefined;

  const tooltipDecimals = (y: number) => (Number.isFinite(y) && Math.abs(y) >= 1000 ? 0 : 2);

  /* ═══ HEATMAP ═══ */
  if (kind === 'heatmap') {
    const labelsX: string[] = (d['labels_x'] as string[]) ?? [];
    const labelsY: string[] = (d['labels_y'] as string[]) ?? [];
    const matrix: (number | null)[][] = (d['matrix'] as (number | null)[][]) ?? [];
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

    return {
      chart: { type: 'heatmap' },
      title: baseTitle,
      subtitle: baseSubtitle,
      colorAxis: {
        min,
        max: max === min ? min + 1e-9 : max,
        minColor: '#F0F4FF',
        maxColor: HC_COLORS.primary,
        labels: {
          style: { color: HC_COLORS.slate500, fontSize: '11px' },
        },
      },
      xAxis: {
        type: 'category',
        categories: labelsX,
        title: data.x_axis ? { text: data.x_axis } : undefined,
      },
      yAxis: {
        type: 'category',
        categories: labelsY,
        title: data.y_axis ? { text: data.y_axis } : undefined,
        reversed: true,
      },
      legend: {
        enabled: true,
        align: 'center',
        verticalAlign: 'bottom',
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
            `<div><span style="color:#CBD5E1">Valeur:</span> <b style="color:#fff">${formatTooltipNumber(val, tooltipDecimals(val))}</b></div>`
          );
        },
      },
      series: [
        {
          type: 'heatmap',
          name: data.y_axis || 'Intensité',
          borderWidth: 1,
          borderColor: '#FFFFFF',
          data: heatData,
        },
      ],
    };
  }

  /* ═══ SCATTER ═══ */
  if (kind === 'scatter') {
    const xs = (d['axis_x'] as number[]) ?? [];
    const ys = (d['axis_y'] as number[]) ?? [];
    const pts = xs
      .map((x, i) => [x, ys[i] ?? NaN] as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

    return {
      chart: { type: 'scatter', zooming: { type: 'xy' } },
      title: baseTitle,
      subtitle: baseSubtitle,
      xAxis: {
        type: 'linear',
        title: data.x_axis ? { text: data.x_axis } : undefined,
        labels: { formatter: axisLabelFormatter },
        gridLineWidth: 1,
        gridLineDashStyle: 'Dot',
        gridLineColor: HC_COLORS.grid,
      },
      yAxis: {
        type: 'linear',
        title: data.y_axis ? { text: data.y_axis } : undefined,
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
            `<div><span style="color:#CBD5E1">${escapeHtml(data.x_axis || 'X')}:</span> <b style="color:#fff">${formatTooltipNumber(px, tooltipDecimals(px))}</b></div>` +
            `<div><span style="color:#CBD5E1">${escapeHtml(data.y_axis || 'Y')}:</span> <b style="color:#fff">${formatTooltipNumber(py, tooltipDecimals(py))}</b></div>`
          );
        },
      },
      series: [
        {
          type: 'scatter',
          name: `${data.y_axis || 'Y'} vs ${data.x_axis || 'X'}`,
          color: HC_SERIES_COLORS[0],
          data: pts,
        },
      ],
    };
  }

  /* ═══ PIE ═══ */
  if (kind === 'pie') {
    const categories = (d['axis_x'] as (string | number)[]) ?? [];
    const values = (d['axis_y'] as (number | null)[]) ?? [];
    const pieData: PointOptionsObject[] = categories.map((name, i) => ({
      name: String(name),
      y: values[i] ?? 0,
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
            format: '<b>{point.name}</b>: {point.percentage:.1f}%',
            style: {
              fontSize: '11px',
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
            `<b style="color:#fff">${formatTooltipNumber(y, tooltipDecimals(y))}</b> ` +
            `<span style="color:#94A3B8">(${this.percentage?.toFixed(1)}%)</span>`
          );
        },
      },
      series: [{ type: 'pie', name: data.y_axis || 'Valeur', data: pieData }],
    };
  }

  /* ═══ COLUMN / LINE / BAR ═══ */
  const categories = (d['axis_x'] as (string | number)[]) ?? [];
  const values = (d['axis_y'] as (number | null)[]) ?? [];
  const seriesData: (number | null)[] = values.map((v) => (v === null || v === undefined ? null : Number(v)));
  const chartType = kind === 'line' ? 'line' : kind === 'bar' ? 'bar' : 'column';

  return {
    chart: { type: chartType },
    title: baseTitle,
    subtitle: baseSubtitle,
    xAxis: {
      type: 'category',
      categories: categories.map((c) => String(c)),
      title: data.x_axis ? { text: data.x_axis } : undefined,
      crosshair: chartType === 'column' ? { color: 'rgba(37, 99, 235, 0.06)', width: 1 } : undefined,
    },
    yAxis: {
      title: data.y_axis ? { text: data.y_axis } : undefined,
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
        pointPadding: 0.08,
        groupPadding: 0.12,
        dataLabels: { enabled: false },
        colorByPoint: categories.length <= 12,
        colors: HC_SERIES_COLORS,
      },
      bar: {
        borderRadius: 4,
        borderWidth: 0,
        pointPadding: 0.08,
        groupPadding: 0.12,
        colorByPoint: categories.length <= 12,
        colors: HC_SERIES_COLORS,
      },
      line: {
        lineWidth: 2.5,
        marker: { radius: 4, symbol: 'circle', lineWidth: 2, lineColor: '#FFFFFF' },
      },
    },
    tooltip: {
      formatter(this: Highcharts.Point) {
        const cat = this.category ?? this.x;
        const y = Number(this.y);
        const name = this.series?.name || data.y_axis || 'Valeur';
        const dotColor = this.color || HC_SERIES_COLORS[0];
        return (
          `<div style="padding:2px 0"><span style="color:#CBD5E1;font-size:11px;font-weight:600">${escapeHtml(String(cat))}</span></div>` +
          `<div><span style="color:${dotColor};font-size:12px">●</span> <span style="color:#CBD5E1">${escapeHtml(String(name))}:</span> <b style="color:#fff">${formatTooltipNumber(y, tooltipDecimals(y))}</b></div>`
        );
      },
    },
    series: [
      {
        type: chartType,
        name: data.y_axis || 'Valeur',
        data: seriesData as (number | null | PointOptionsObject)[],
        color: HC_SERIES_COLORS[0],
      },
    ],
  };
}
