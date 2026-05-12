import type { Options, PointOptionsObject } from 'highcharts';
import Highcharts from 'highcharts';
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

function normalizeDashboardKind(data: ChartDataResponse): 'heatmap' | 'scatter' | 'line' | 'column' {
  const raw = `${data.chart_title} ${data.aggregation ?? ''}`.toLowerCase();
  if (raw.includes('scatter')) {
    return 'scatter';
  }
  if (raw.includes('heat') || raw.includes('crosstab')) {
    return 'heatmap';
  }
  if (raw.includes('line') || raw.includes('trend')) {
    return 'line';
  }
  return 'column';
}

export function buildDashboardChartOptions(data: ChartDataResponse): Options {
  const kind = normalizeDashboardKind(data);
  const titleText = data.chart_title;
  const d = data.data ?? {};

  const baseTitle: Options['title'] = {
    text: titleText,
    align: 'left',
    margin: 12,
  };

  const tooltipDecimals = (y: number) => (Number.isFinite(y) && Math.abs(y) >= 1000 ? 0 : 2);

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
      colorAxis: {
        min,
        max: max === min ? min + 1e-9 : max,
        minColor: '#F8FAFC',
        maxColor: HC_COLORS.primary,
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
      tooltip: {
        formatter(this: Highcharts.Point) {
          const xIdx = Number(this.x);
          const yIdx = Number(this.y);
          const lx = labelsX[xIdx] ?? String(this.x);
          const ly = labelsY[yIdx] ?? String(this.y);
          const val = Number(this.value);
          return (
            `<b>${escapeHtml(String(ly))}</b> × ` +
            `<b>${escapeHtml(String(lx))}</b><br/>` +
            `Valeur: <b>${formatTooltipNumber(Highcharts, val, tooltipDecimals(val))}</b>`
          );
        },
      },
      series: [
        {
          type: 'heatmap',
          name: data.y_axis || 'Intensité',
          borderWidth: 0.5,
          borderColor: HC_COLORS.border,
          data: heatData,
        },
      ],
    };
  }

  if (kind === 'scatter') {
    const xs = (d['axis_x'] as number[]) ?? [];
    const ys = (d['axis_y'] as number[]) ?? [];
    const pts = xs
      .map((x, i) => [x, ys[i] ?? NaN] as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

    return {
      chart: { type: 'scatter', zooming: { type: 'xy' } },
      title: baseTitle,
      xAxis: {
        type: 'linear',
        title: data.x_axis ? { text: data.x_axis } : undefined,
        labels: { formatter: axisLabelFormatter },
        gridLineWidth: 1,
      },
      yAxis: {
        type: 'linear',
        title: data.y_axis ? { text: data.y_axis } : undefined,
        labels: { formatter: axisLabelFormatter },
      },
      tooltip: {
        formatter(this: Highcharts.Point) {
          const px = Number(this.x);
          const py = Number(this.y);
          return (
            `<b>${escapeHtml(data.x_axis || 'X')}</b>: ` +
            `<b>${formatTooltipNumber(Highcharts, px, tooltipDecimals(px))}</b><br/>` +
            `<b>${escapeHtml(data.y_axis || 'Y')}</b>: ` +
            `<b>${formatTooltipNumber(Highcharts, py, tooltipDecimals(py))}</b>`
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

  const categories = (d['axis_x'] as (string | number)[]) ?? [];
  const values = (d['axis_y'] as (number | null)[]) ?? [];
  const seriesData: (number | null)[] = values.map((v) => (v === null || v === undefined ? null : Number(v)));
  const chartType = kind === 'line' ? 'line' : 'column';

  return {
    chart: { type: chartType },
    title: baseTitle,
    xAxis: {
      type: 'category',
      categories: categories.map((c) => String(c)),
      title: data.x_axis ? { text: data.x_axis } : undefined,
    },
    yAxis: {
      title: data.y_axis ? { text: data.y_axis } : undefined,
      labels: { formatter: axisLabelFormatter },
    },
    plotOptions: {
      column: {
        borderRadius: 3,
        pointPadding: 0.08,
        groupPadding: 0.12,
      },
      line: {
        marker: { radius: 3, symbol: 'circle' },
      },
    },
    tooltip: {
      shared: chartType === 'column',
      formatter(this: Highcharts.Point) {
        const cat = this.category ?? this.x;
        const y = Number(this.y);
        const name = this.series?.name || data.y_axis || 'Valeur';
        return (
          `<b>${escapeHtml(String(cat))}</b><br/>` +
          `${escapeHtml(String(name))}: <b>${formatTooltipNumber(Highcharts, y, tooltipDecimals(y))}</b>`
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
