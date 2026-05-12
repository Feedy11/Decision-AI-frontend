import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
} from '@angular/core';
import type { ChartConstructorType } from 'highcharts-angular';
import { HighchartsChartComponent } from 'highcharts-angular';
import type { Options } from 'highcharts';
import type Highcharts from 'highcharts';

/**
 * Shared Highcharts host for Angular (official `highcharts-angular` wrapper).
 * Global theme and modules are registered via `provideHighcharts()` in `app.config.ts`
 * using the same defaults as `HIGHCHARTS_GLOBAL_OPTIONS` (Highcharts.setOptions equivalent).
 */
@Component({
  selector: 'app-highcharts-base',
  standalone: true,
  imports: [HighchartsChartComponent],
  template: `
    <highcharts-chart
      class="hc-base-host"
      [constructorType]="constructorType"
      [options]="chartOptions()"
      [style.height.px]="heightPx()"
      (chartInstance)="onChartReady($event)"
    />
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .hc-base-host {
        display: block;
        width: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HighchartsBaseComponent {
  /** Native Highcharts options — prefer column, line, scatter, heatmap, pie, bar per docs. */
  readonly chartOptions = input.required<Options>();

  /** Plot container height in CSS pixels. */
  readonly heightPx = input<number>(280);

  /**
   * When the host becomes visible again (e.g. switching to the Charts tab), reflow so
   * `chart.reflow` respects responsive layout.
   */
  readonly chartVisible = input<boolean>(true);

  readonly constructorType: ChartConstructorType = 'chart';

  readonly chartInstance = output<Highcharts.Chart>();

  private chart?: Highcharts.Chart;

  constructor() {
    effect(() => {
      const visible = this.chartVisible();
      void this.heightPx();
      if (visible && this.chart) {
        queueMicrotask(() => this.chart?.reflow());
      }
    });
  }

  protected onChartReady(chart: Highcharts.Chart): void {
    this.chart = chart;
    this.chartInstance.emit(chart);
    if (this.chartVisible()) {
      queueMicrotask(() => chart.reflow());
    }
  }
}
