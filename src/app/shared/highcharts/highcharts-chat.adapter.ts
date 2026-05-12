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

export function buildChatChartOptions(spec: ChartSpec): Options {
  const titleText = spec.title || 'Graphique';
  const d = spec.data;
  const hasData =
    d &&
    Array.isArray(d['axis_x']) &&
    Array.isArray(d['axis_y']) &&
    d['axis_x'].length > 0;

  const baseTitle: Options['title'] = {
    text: titleText,
    align: 'left',
    margin: 10,
  };

  const tooltipDecimals = (y: number) => (Number.isFinite(y) && Math.abs(y) >= 1000 ? 0 : 2);

  if (spec.chart_type === 'pie') {
    const xs: string[] = hasData ? (d!['axis_x'] as string[]).map(String) : [];
    const ys: number[] = hasData ? (d!['axis_y'] as number[]).map(Number) : [];
    const pieData: PointOptionsObject[] = xs.map((name, i) => ({
      name,
      y: ys[i] ?? 0,
    }));

    return {
      chart: { type: 'pie' },
      title: baseTitle,
      plotOptions: {
        pie: {
          allowPointSelect: true,
          cursor: 'pointer',
          dataLabels: {
            enabled: true,
            format: '<b>{point.name}</b>: {point.percentage:.1f} %',
            style: { fontSize: '10px' },
          },
          showInLegend: true,
        },
      },
      tooltip: {
        pointFormatter(this: Highcharts.Point) {
          const y = Number(this.y);
          return (
            `<span style="color:${this.color}">●</span> ` +
            `<b>${escapeHtml(String(this.name))}</b>: ` +
            `<b>${formatTooltipNumber(Highcharts, y, tooltipDecimals(y))}</b> ` +
            `(${this.percentage?.toFixed(1)}%)`
          );
        },
      },
      series: [{ type: 'pie', name: spec.y_col || 'Valeur', data: pieData, colors: HC_SERIES_COLORS }],
    };
  }

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
      colorAxis: {
        min,
        max: cmax,
        minColor: '#F8FAFC',
        maxColor: HC_COLORS.primary,
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
      tooltip: {
        formatter(this: Highcharts.Point) {
          const xIdx = Number(this.x);
          const yIdx = Number(this.y);
          const lx = labelsX[xIdx] ?? String(this.x);
          const ly = labelsY[yIdx] ?? String(this.y);
          const val = Number(this.value);
          return (
            `<b>${escapeHtml(String(ly))}</b> × <b>${escapeHtml(String(lx))}</b><br/>` +
            `Valeur: <b>${formatTooltipNumber(Highcharts, val, tooltipDecimals(val))}</b>`
          );
        },
      },
      series: [
        {
          type: 'heatmap',
          name: spec.y_col || 'Intensité',
          borderWidth: 0.5,
          borderColor: HC_COLORS.border,
          data: heatData,
        },
      ],
    };
  }

  if (spec.chart_type === 'scatter') {
    const xs = (hasData ? d!['axis_x'] : []) as number[];
    const ys = (hasData ? d!['axis_y'] : []) as number[];
    const pts = xs
      .map((x, i) => [x, ys[i] ?? NaN] as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

    return {
      chart: { type: 'scatter', zooming: { type: 'xy' } },
      title: baseTitle,
      xAxis: {
        type: 'linear',
        title: spec.x_col ? { text: spec.x_col } : undefined,
        labels: { formatter: axisLabelFormatter },
      },
      yAxis: {
        type: 'linear',
        title: spec.y_col ? { text: spec.y_col } : undefined,
        labels: { formatter: axisLabelFormatter },
      },
      tooltip: {
        formatter(this: Highcharts.Point) {
          const px = Number(this.x);
          const py = Number(this.y);
          return (
            `<b>${escapeHtml(spec.x_col || 'X')}</b>: ` +
            `<b>${formatTooltipNumber(Highcharts, px, tooltipDecimals(px))}</b><br/>` +
            `<b>${escapeHtml(spec.y_col || 'Y')}</b>: ` +
            `<b>${formatTooltipNumber(Highcharts, py, tooltipDecimals(py))}</b>`
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

  const chartType =
    spec.chart_type === 'line'
      ? 'line'
      : spec.chart_type === 'bar' || spec.chart_type === 'histogram'
        ? 'column'
        : 'column';
  const categories = hasData ? (d!['axis_x'] as (string | number)[]).map(String) : [];
  const values = hasData ? (d!['axis_y'] as number[]) : [];

  return {
    chart: { type: chartType },
    title: baseTitle,
    xAxis: {
      type: 'category',
      categories,
      title: spec.x_col ? { text: spec.x_col } : undefined,
    },
    yAxis: {
      title: spec.y_col ? { text: spec.y_col } : undefined,
      labels: { formatter: axisLabelFormatter },
    },
    plotOptions: {
      column: {
        borderRadius: 3,
        dataLabels: { enabled: false },
      },
      line: {
        marker: { radius: 3 },
      },
    },
    tooltip: {
      formatter(this: Highcharts.Point) {
        const y = Number(this.y);
        const name = this.series?.name || spec.y_col || 'Valeur';
        const cat = this.category ?? this.x;
        return (
          `<b>${escapeHtml(String(cat))}</b><br/>` +
          `${escapeHtml(String(name))}: <b>${formatTooltipNumber(Highcharts, y, tooltipDecimals(y))}</b>`
        );
      },
    },
    series: [
      {
        type: chartType,
        name: spec.y_col || 'Valeur',
        data: values as (number | null | PointOptionsObject)[],
        color: HC_SERIES_COLORS[0],
      },
    ],
  };
}
