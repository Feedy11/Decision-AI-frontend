import { Component, OnInit, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { FormsModule }        from '@angular/forms';
import { RouterModule, Router }       from '@angular/router';
import { ToastrService }      from 'ngx-toastr';
import { DashboardService }   from '../core/services/dashboard.service';
import { IaServicesService }  from '../core/services/ia-services.service';
import { WorkflowService }    from '../core/services/workflow.service';
import { FailedChartsPipe }   from '../chartsPipe/Failed charts.pipe';
import {
  DashboardRecord,
  DashboardExecuteResponse,
  KpiExecutionResult,
  ChartMetadata,
  ChartDataResponse
} from '../models/Dashboard.model';
import { Dataset } from '../models/Dataset.model';
import { catchError, forkJoin, of } from 'rxjs';

declare const ApexCharts: any;

@Component({
  selector   : 'app-dashboard',
  standalone : true,
  imports    : [CommonModule, FormsModule, RouterModule, FailedChartsPipe],
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
  apexInstances     : any[] = [];

  // ── UI states ─────────────────────────────────────────────
  isGenerating        = false;
  isExecuting         = false;
  isLoadingCharts     = false;
  isLoadingDashboards = false;

  activeTab: 'overview' | 'charts' = 'overview';

  constructor(
    private dashSvc  : DashboardService,
    private iaService: IaServicesService,
    private toastr   : ToastrService,
    private ngZone   : NgZone,
    private wf       : WorkflowService,
    private router   : Router
  ) {}

  ngOnInit(): void {
    this.loadDatasets();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private loadDatasets(): void {
    this.iaService.getMyDatasets(1, 100).subscribe({
      next : (res) => { 
        if (this.router.url.includes('/workflow/')) {
          const wfDatasetId = this.wf.getDatasetId();
          if (wfDatasetId) {
            this.datasets = res.datasets.filter(d => d.id === wfDatasetId);
            this.selectedDatasetId = wfDatasetId;
            this.loadSavedDashboards();
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
        this.savedDashboards   = [d, ...this.savedDashboards];
        this.toastr.success(
          `${d.executive_summary_kpis.length} KPIs et ${d.dashboard_charts.length} graphiques générés.`,
          'Dashboard créé', { timeOut: 4000, progressBar: true }
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
          ? 'GEMINI_API_KEY non configurée dans le backend.'
          : err.error?.detail || 'Erreur de génération.';
        this.toastr.error(msg, 'Erreur ', { timeOut: 6000, progressBar: true });
      }
    });
  }

  // ── Charger les dashboards sauvegardés ────────────────────
  loadSavedDashboards(): void {
    if (!this.selectedDatasetId) return;
    this.isLoadingDashboards = true;

    this.dashSvc.getDashboards(this.selectedDatasetId).subscribe({
      next: (list) => {
        this.isLoadingDashboards = false;
        this.savedDashboards     = list;
      },
      error: () => { this.isLoadingDashboards = false; }
    });
  }

  // ── Sélectionner un dashboard → exécuter auto ────────────
  selectDashboard(d: DashboardRecord): void {
    if (this.selectedDashboard?.id === d.id) return;
    this.selectedDashboard = d;
    this.executeResult     = null;
    this.chartDataMap      = {};
    this.destroyCharts();
    this.activeTab = 'overview';
    // Auto-exécuter au clic sur un dashboard de l'historique
    this.executeAndLoadCharts(d.id);
  }

  // ── Exécuter + charger TOUS les graphiques automatiquement ─
  private executeAndLoadCharts(dashboardId: number): void {
    this.isExecuting = true;
    this.destroyCharts();

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
              if (data) this.chartDataMap[charts[i].chart_index] = data;
            });
            // Les divs existent toujours dans le DOM grâce à [hidden]
            // Un seul setTimeout suffit pour laisser Angular terminer le CD
            setTimeout(() => {
              this.destroyCharts();
              charts.forEach(c => this.renderChart(c.chart_index));
              this.wf.completeCurrentStep();
            }, 100);
          },
          error: () => { this.isLoadingCharts = false; }
        });
      },
      error: () => {
        this.isExecuting = false;
        this.toastr.error('Erreur lors de l\'exécution.', 'Erreur', { timeOut: 4000, progressBar: true });
      }
    });
  }

  // ── Exécuter manuellement (bouton) ───────────────────────
  executeDashboard(): void {
    if (!this.selectedDashboard) return;
    this.executeAndLoadCharts(this.selectedDashboard.id);
  }

  // ── Rendu ApexCharts ──────────────────────────────────────
  private renderChart(index: number): void {
    const data = this.chartDataMap[index];
    if (!data?.execution_success) return;

    const el = document.getElementById(`chart-${index}`);
    if (!el) return;
    // Vider le container avant de re-rendre
    el.innerHTML = '';

    const opts = this.buildApexOptions(data);
    if (!opts) return;

    try {
      const chart = new ApexCharts(el, opts);
      chart.render();
      this.apexInstances.push(chart);
    } catch (e) {}
  }

  private buildApexOptions(data: ChartDataResponse): any {
    const type = this.normalizeChartType(data);
    const d    = data.data;

    const base = {
      chart    : { type, height: 260, toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
      theme    : { mode: 'light' },
      colors   : ['#2563EB', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444'],
      dataLabels: { enabled: false },
      grid     : { borderColor: '#F1F5F9', strokeDashArray: 4 },
      tooltip  : { theme: 'light' },
      xaxis    : { labels: { style: { fontSize: '11px', colors: '#64748B' } } },
      yaxis    : { labels: { style: { fontSize: '11px', colors: '#64748B' } } },
    };

    if (type === 'bar' || type === 'line') {
      return {
        ...base,
        series: [{ name: data.y_axis || 'Valeur', data: d['axis_y'] || [] }],
        xaxis : { ...base.xaxis, categories: d['axis_x'] || [] }
      };
    }

    if (type === 'scatter') {
      const xs: number[] = d['axis_x'] || [];
      const ys: number[] = d['axis_y'] || [];
      return {
        ...base,
        series: [{ name: 'Points', data: xs.map((x, i) => ({ x, y: ys[i] })) }]
      };
    }

    if (type === 'heatmap') {
      const labelsY: string[]   = d['labels_y'] || [];
      const matrix : number[][] = d['matrix']   || [];
      const labelsX: string[]   = d['labels_x'] || [];
      return {
        ...base,
        series: labelsY.map((label, i) => ({ name: label, data: matrix[i] || [] })),
        xaxis : { ...base.xaxis, categories: labelsX }
      };
    }

    return null;
  }

  private normalizeChartType(data: ChartDataResponse): string {
    const raw = (data.chart_title + (data.aggregation || '')).toLowerCase();
    if (raw.includes('scatter'))                     return 'scatter';
    if (raw.includes('heat') || raw.includes('crosstab')) return 'heatmap';
    if (raw.includes('line') || raw.includes('trend'))    return 'line';
    return 'bar';
  }

  private destroyCharts(): void {
    this.apexInstances.forEach(c => { try { c.destroy(); } catch {} });
    this.apexInstances = [];
  }

  // ── Helpers ──────────────────────────────────────────────
  getKpiValue(kpi: KpiExecutionResult): string {
    if (!kpi.execution_success) return 'Erreur';
    if (kpi.formatted_value)    return kpi.formatted_value;
    if (kpi.value !== null && kpi.value !== undefined)
      return Number(kpi.value).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
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
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  get successfulKpis(): KpiExecutionResult[] {
    return this.executeResult?.kpi_results.filter(k => k.execution_success) ?? [];
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
