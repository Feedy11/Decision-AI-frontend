import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  ElementRef,
  HostListener,
  input,
  output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ChartConstructorType } from 'highcharts-angular';
import { HighchartsChartComponent } from 'highcharts-angular';
import type { Options } from 'highcharts';
import type Highcharts from 'highcharts';

/**
 * Shared Highcharts host for Angular (official `highcharts-angular` wrapper).
 * Global theme and modules are registered via `provideHighcharts()` in `app.config.ts`
 * using the same defaults as `HIGHCHARTS_GLOBAL_OPTIONS` (Highcharts.setOptions equivalent).
 *
 * Features:
 * - Fullscreen toggle button (native browser Fullscreen API)
 * - Responsive reflow on visibility changes
 * - Built-in exporting hamburger menu (via global options)
 */
@Component({
  selector: 'app-highcharts-base',
  standalone: true,
  imports: [CommonModule, HighchartsChartComponent],
  template: `
    <div class="hc-wrapper" [class.is-fullscreen]="isFullscreen" #wrapper>
      <div class="hc-toolbar">
        <button
          class="hc-fullscreen-btn"
          (click)="toggleFullscreen()"
          [title]="isFullscreen ? 'Quitter le plein écran' : 'Plein écran'"
          type="button"
        >
          <!-- Expand icon -->
          <svg *ngIf="!isFullscreen" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <!-- Minimize icon -->
          <svg *ngIf="isFullscreen" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>
      </div>

      <highcharts-chart
        class="hc-base-host"
        [constructorType]="constructorType"
        [options]="chartOptions()"
        [style.height.px]="currentHeight"
        (chartInstance)="onChartReady($event)"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .hc-wrapper {
        position: relative;
        width: 100%;
        background: #fff;
        border-radius: 8px;
      }

      /* ── Native fullscreen mode ── */
      .hc-wrapper.is-fullscreen {
        background: #fff;
        padding: 24px 32px 32px;
        display: flex;
        flex-direction: column;
      }

      .hc-wrapper.is-fullscreen .hc-base-host {
        flex: 1;
        width: 100%;
      }

      .hc-wrapper.is-fullscreen .hc-toolbar {
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 20;
      }

      .hc-wrapper.is-fullscreen .hc-fullscreen-btn {
        background: rgba(241, 245, 249, 0.95);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        padding: 8px 10px;
        border-radius: 8px;
      }

      .hc-base-host {
        display: block;
        width: 100%;
      }

      .hc-toolbar {
        position: absolute;
        top: 10px;
        right: 48px;
        z-index: 5;
      }

      .hc-fullscreen-btn {
        background: rgba(241, 245, 249, 0.85);
        border: 1px solid #E2E8F0;
        border-radius: 6px;
        padding: 5px 7px;
        cursor: pointer;
        color: #64748B;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        backdrop-filter: blur(4px);
      }

      .hc-fullscreen-btn:hover {
        background: #E2E8F0;
        color: #1E293B;
        transform: scale(1.08);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HighchartsBaseComponent {
  /** Native Highcharts options — prefer column, line, scatter, heatmap, pie, bar per docs. */
  readonly chartOptions = input.required<Options>();

  /** Plot container height in CSS pixels. */
  readonly heightPx = input<number>(320);

  /**
   * When the host becomes visible again (e.g. switching to the Charts tab), reflow so
   * `chart.reflow` respects responsive layout.
   */
  readonly chartVisible = input<boolean>(true);

  readonly constructorType: ChartConstructorType = 'chart';

  readonly chartInstance = output<Highcharts.Chart>();

  @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLElement>;

  private chart?: Highcharts.Chart;
  isFullscreen = false;
  currentHeight = 320;

  constructor(private cdr: ChangeDetectorRef) {
    effect(() => {
      if (!this.isFullscreen) {
        this.currentHeight = this.heightPx();
      }
    });
    effect(() => {
      const visible = this.chartVisible();
      void this.heightPx();
      if (visible && this.chart) {
        queueMicrotask(() => this.chart?.reflow());
      }
    });
  }

  /** Listen for the browser's fullscreenchange event (ESC key, etc.) */
  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    const wasFullscreen = this.isFullscreen;
    this.isFullscreen = !!document.fullscreenElement;

    if (wasFullscreen && !this.isFullscreen) {
      // Exited fullscreen (ESC key or programmatic)
      this.currentHeight = this.heightPx();
    }

    this.cdr.markForCheck();
    setTimeout(() => this.chart?.reflow(), 150);
  }

  protected onChartReady(chart: Highcharts.Chart): void {
    this.chart = chart;
    this.chartInstance.emit(chart);
    if (this.chartVisible()) {
      queueMicrotask(() => chart.reflow());
    }
  }

  async toggleFullscreen(): Promise<void> {
    const wrapper = this.wrapperRef?.nativeElement;
    if (!wrapper) return;

    try {
      if (!this.isFullscreen) {
        // Enter native fullscreen
        await wrapper.requestFullscreen();
        this.isFullscreen = true;
        // Use screen height minus padding
        this.currentHeight = screen.height - 80;
      } else {
        // Exit native fullscreen
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
        this.isFullscreen = false;
        this.currentHeight = this.heightPx();
      }
    } catch (err) {
      console.warn('Fullscreen API error:', err);
      // Fallback: still update state
      this.isFullscreen = false;
      this.currentHeight = this.heightPx();
    }

    this.cdr.markForCheck();
    setTimeout(() => this.chart?.reflow(), 200);
  }
}
