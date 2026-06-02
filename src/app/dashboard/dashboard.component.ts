import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { FormsModule }        from '@angular/forms';
import { RouterModule, Router }       from '@angular/router';
import { ToastrService }      from 'ngx-toastr';
import type { Options } from 'highcharts';
import { DashboardService }   from '../core/services/dashboard.service';
import { IaServicesService }  from '../core/services/ia-services.service';
import { WorkflowService }    from '../core/services/workflow.service';
import {
  DashboardRecord,
  DashboardExecuteResponse,
  KpiExecutionResult,
  ChartMetadata,
  ChartDataResponse
} from '../models/Dashboard.model';
import { Dataset } from '../models/Dataset.model';
import { catchError, forkJoin, of } from 'rxjs';
import { HighchartsBaseComponent } from '../shared/highcharts/highcharts-base.component';
import { buildDashboardChartOptions } from '../shared/highcharts/highcharts-dashboard.adapter';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector   : 'app-dashboard',
  standalone : true,
  imports    : [CommonModule, FormsModule, RouterModule, HighchartsBaseComponent, TranslocoPipe],
  templateUrl: './dashboard.component.html',
  styleUrls  : ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {

  // ── Datasets ─────────────────────────────────────────────
  datasets          : Dataset[]  = [];
  selectedDatasetId : number | null = null;

  // ── Dashboards sauvegardés ────────────────────────────────
  savedDashboards   : DashboardRecord[] = [];
  selectedDashboard : DashboardRecord | null = null;

  // ── Résultats exécution ───────────────────────────────────
  executeResult     : DashboardExecuteResponse | null = null;
  chartDataMap      : Record<number, ChartDataResponse> = {};
  /** Stable Highcharts options per chart index (avoids re-creating options each CD cycle). */
  chartHighchartsOptions: Record<number, Options> = {};

  // ── UI states ─────────────────────────────────────────────
  isGenerating        = false;
  isExecuting         = false;
  isLoadingCharts     = false;
  isLoadingDashboards = false;


  private dashboardLoadSeq = 0;

  constructor(
    private dashSvc  : DashboardService,
    private iaService: IaServicesService,
    private toastr   : ToastrService,
    private wf       : WorkflowService,
    private router   : Router,
    private translocoService: TranslocoService
  ) {}

  ngOnInit(): void {
    this.loadDatasets();
  }

  ngOnDestroy(): void {
    this.chartHighchartsOptions = {};
  }

  private loadDatasets(): void {
    this.iaService.getMyDatasets(1, 100).subscribe({
      next : (res) => { 
        if (this.router.url.includes('/workflow/')) {
          const wfDatasetId = this.wf.getDatasetId();
          if (wfDatasetId) {
            this.datasets = res.datasets.filter(d => d.id === wfDatasetId);
            this.selectedDatasetId = wfDatasetId;
            this.onDatasetChange(wfDatasetId);
          } else {
            this.datasets = res.datasets; 
          }
        } else {
          this.datasets = res.datasets; 
        }
      },
      error: () => {}
    });
  }

  onDatasetChange(datasetId: number | null): void {
    this.dashboardLoadSeq++;
    this.selectedDatasetId = datasetId;
    this.savedDashboards = [];
    this.selectedDashboard = null;
    this.executeResult = null;
    this.chartDataMap = {};
    this.chartHighchartsOptions = {};

    if (!datasetId) {
      this.isLoadingDashboards = false;
      return;
    }

    this.loadSavedDashboards(true);
  }

  // ── Générer → exécuter → charger graphiques automatiquement ──
  generateDashboard(): void {
    if (!this.selectedDatasetId) return;
    this.isGenerating = true;

    this.dashSvc.generateAndSave(this.selectedDatasetId).subscribe({
      next: (d) => {
        this.isGenerating      = false;
        this.selectedDashboard = d;
        this.executeResult     = null;
        this.chartDataMap      = {};
        this.chartHighchartsOptions = {};
        this.savedDashboards   = [d, ...this.savedDashboards];
        this.toastr.success(
          this.translocoService.translate('dashboard.generateSuccessMsg', {
            kpisCount: d.executive_summary_kpis.length,
            chartsCount: d.dashboard_charts.length
          }),
          this.translocoService.translate('dashboard.dashboardCreated'),
          { timeOut: 4000, progressBar: true }
        );
        // Track dashboard count for profile stats
        const count = parseInt(localStorage.getItem('dashboard_count') || '0', 10);
        localStorage.setItem('dashboard_count', String(count + 1));
        // Auto-exécuter immédiatement après génération
        this.executeAndLoadCharts(d.id);
      },
      error: (err) => {
        this.isGenerating = false;
        const msg = err.status === 503
          ? this.translocoService.translate('dashboard.geminiNotConfigured')
          : err.error?.detail || this.translocoService.translate('dashboard.generationError');
        this.toastr.error(
          msg,
          this.translocoService.translate('common.error'),
          { timeOut: 6000, progressBar: true }
        );
      }
    });
  }

  // ── Charger les dashboards sauvegardés ────────────────────
  loadSavedDashboards(autoSelectLatest = false): void {
    if (!this.selectedDatasetId) return;
    const loadSeq = this.dashboardLoadSeq;
    this.isLoadingDashboards = true;

    this.dashSvc.getDashboards(this.selectedDatasetId).subscribe({
      next: (list) => {
        if (loadSeq !== this.dashboardLoadSeq) return;
        this.isLoadingDashboards = false;
        this.savedDashboards     = list;
        if (autoSelectLatest && list.length > 0) {
          this.selectDashboard(list[0]);
        }
      },
      error: () => {
        if (loadSeq === this.dashboardLoadSeq) this.isLoadingDashboards = false;
      }
    });
  }

  // ── Sélectionner un dashboard → exécuter auto ────────────
  selectDashboard(d: DashboardRecord): void {
    if (this.selectedDashboard?.id === d.id) return;
    this.selectedDashboard = d;
    this.executeResult     = null;
    this.chartDataMap      = {};
    this.chartHighchartsOptions = {};
    // Auto-exécuter au clic sur un dashboard de l'historique
    this.executeAndLoadCharts(d.id);
  }

  // ── Exécuter + charger TOUS les graphiques automatiquement ─
  private executeAndLoadCharts(dashboardId: number): void {
    this.isExecuting = true;
    this.chartDataMap = {};
    this.chartHighchartsOptions = {};

    this.dashSvc.executeDashboard(dashboardId).subscribe({
      next: (res) => {
        this.isExecuting   = false;
        this.executeResult = res;

        const charts = res.chart_results.filter(c => c.execution_success);
        if (charts.length === 0) return;

        // Charger toutes les données en parallèle (forkJoin)
        this.isLoadingCharts = true;
        const requests = charts.map(c =>
          this.dashSvc.getChartData(dashboardId, c.chart_index).pipe(
            catchError(() => of(null))
          )
        );

        forkJoin(requests).subscribe({
          next: (results) => {
            this.isLoadingCharts = false;
            results.forEach((data, i) => {
              if (!data) return;
              const idx = charts[i].chart_index;
              this.chartDataMap[idx] = data;
              if (data.execution_success) {
                this.chartHighchartsOptions[idx] = buildDashboardChartOptions(data);
              }
            });
            queueMicrotask(() => this.wf.completeCurrentStep());
          },
          error: () => { this.isLoadingCharts = false; }
        });
      },
      error: () => {
        this.isExecuting = false;
        this.toastr.error(
          this.translocoService.translate('dashboard.executionError'),
          this.translocoService.translate('common.error'),
          { timeOut: 4000, progressBar: true }
        );
      }
    });
  }

  // ── Exécuter manuellement (bouton) ───────────────────────
  executeDashboard(): void {
    if (!this.selectedDashboard) return;
    this.executeAndLoadCharts(this.selectedDashboard.id);
  }

  highchartsOptionsForIndex(index: number): Options | undefined {
    return this.chartHighchartsOptions[index];
  }

  // ── Helpers ──────────────────────────────────────────────
  getKpiValue(kpi: KpiExecutionResult): string {
    if (!kpi.execution_success) return this.translocoService.translate('common.error');
    if (kpi.formatted_value)    return kpi.formatted_value;
    if (kpi.value !== null && kpi.value !== undefined) {
      const activeLang = this.translocoService.getActiveLang();
      const locale = activeLang === 'en' ? 'en-US' : 'fr-FR';
      return Number(kpi.value).toLocaleString(locale, { maximumFractionDigits: 2 });
    }
    return '—';
  }

  getStrengthPct(score: number): number { return Math.round(score * 100); }

  getChartTypeIcon(type?: string | null): string {
    const t = (type || '').toLowerCase();
    if (t.includes('bar'))     return '▊';
    if (t.includes('line'))    return '〰';
    if (t.includes('scatter')) return '⬡';
    if (t.includes('heat'))    return '⬛';
    return '📊';
  }

  formatDate(iso: string): string {
    const activeLang = this.translocoService.getActiveLang();
    const locale = activeLang === 'en' ? 'en-US' : 'fr-FR';
    return new Date(iso).toLocaleDateString(locale, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  get successfulKpis(): KpiExecutionResult[] {
    return this.executeResult?.kpi_results.filter(k => k.execution_success) ?? [];
  }

  get visibleKpis(): KpiExecutionResult[] {
    return this.successfulKpis.slice(0, 8);
  }

  get successfulCharts(): ChartMetadata[] {
    return this.executeResult?.chart_results.filter(c => c.execution_success) ?? [];
  }

  get isLoading(): boolean {
    return this.isExecuting || this.isLoadingCharts;
  }

  // ── Navigate to Report page ───────────────────────────────
  goToReport(): void {
    if (!this.selectedDatasetId) return;
    this.router.navigate(['/report'], {
      queryParams: { datasetId: this.selectedDatasetId }
    });
  }
}
