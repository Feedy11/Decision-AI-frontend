import { Component, OnInit }  from '@angular/core';
import { CommonModule }        from '@angular/common';
import { FormsModule }         from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ToastrService }       from 'ngx-toastr';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DashboardService }    from '../core/services/dashboard.service';
import { IaServicesService }   from '../core/services/ia-services.service';
import { WorkflowService }     from '../core/services/workflow.service';
import {
  DashboardRecord,
  DashboardExecuteResponse,
  KpiExecutionResult
} from '../models/Dashboard.model';
import { Dataset } from '../models/Dataset.model';

@Component({
  selector   : 'app-kpi',
  standalone : true,
  imports    : [CommonModule, FormsModule, RouterModule, TranslocoPipe],
  templateUrl: './kpi.component.html',
  styleUrls  : ['./kpi.component.css']
})
export class KpiComponent implements OnInit {

  // ── Datasets ─────────────────────────────────────────────
  datasets         : Dataset[]  = [];
  selectedDatasetId: number | null = null;

  // ── Dashboard + exécution ─────────────────────────────────
  lastDashboard   : DashboardRecord | null = null;
  executeResult   : DashboardExecuteResponse | null = null;

  // ── États ─────────────────────────────────────────────────
  isLoadingDatasets  = false;
  isLoadingDashboard = false;
  isExecuting        = false;

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

  //Charger les datasets
  private loadDatasets(): void {
    this.isLoadingDatasets = true;
    this.iaService.getMyDatasets(1, 100).subscribe({
      next : (res) => { 
        if (this.router.url.includes('/workflow/')) {
          const wfDatasetId = this.wf.getDatasetId();
          if (wfDatasetId) {
            this.datasets = res.datasets.filter(d => d.id === wfDatasetId);
            this.selectedDatasetId = wfDatasetId;
            // auto-trigger dashboard fetch
            this.onDatasetChange();
          } else {
            this.datasets = res.datasets; 
          }
        } else {
          this.datasets = res.datasets; 
        }
        this.isLoadingDatasets = false; 
      },
      error: () => { this.isLoadingDatasets = false; }
    });
  }

  // ── Quand on choisit un dataset → charger dernier dashboard
  onDatasetChange(): void {
    if (!this.selectedDatasetId) return;
    this.lastDashboard  = null;
    this.executeResult  = null;
    this.isLoadingDashboard = true;

    // GET /api/v1/datasets/{id}/dashboards → prendre le premier (plus récent)
    this.dashSvc.getDashboards(this.selectedDatasetId, 0, 1).subscribe({
      next: (list) => {
        this.isLoadingDashboard = false;
        if (list.length === 0) {
          this.toastr.warning(
            this.translocoService.translate('kpi.toastr.noDashboardMsg'),
            this.translocoService.translate('kpi.toastr.noDashboardTitle'),
            { timeOut: 5000, progressBar: true }
          );
          return;
        }
        this.lastDashboard = list[0];
        // Auto-exécuter pour avoir les vraies valeurs
        this.executeDashboard();
      },
      error: () => {
        this.isLoadingDashboard = false;
        this.toastr.error(
          this.translocoService.translate('kpi.toastr.loadDashboardError'),
          this.translocoService.translate('common.error'),
          { timeOut: 4000, progressBar: true }
        );
      }
    });
  }

  // ── Exécuter le dashboard → KPIs réels ───────────────────
  executeDashboard(): void {
    if (!this.lastDashboard) return;
    this.isExecuting   = true;
    this.executeResult = null;

    this.dashSvc.executeDashboard(this.lastDashboard.id).subscribe({
      next: (res) => {
        this.isExecuting   = false;
        this.executeResult = res;
        this.toastr.success(
          this.translocoService.translate('kpi.toastr.calculatedMsg', { count: this.successfulKpis.length }),
          this.translocoService.translate('kpi.toastr.readyTitle'),
          { timeOut: 3000, progressBar: true }
        );
        // Track KPI count for profile stats
        const currentKpiCount = parseInt(localStorage.getItem('kpi_count') || '0', 10);
        localStorage.setItem('kpi_count', String(currentKpiCount + this.successfulKpis.length));
      },
      error: () => {
        this.isExecuting = false;
        this.toastr.error(
          this.translocoService.translate('kpi.toastr.computeError'),
          this.translocoService.translate('common.error'),
          { timeOut: 4000, progressBar: true }
        );
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  get successfulKpis(): KpiExecutionResult[] {
    return this.executeResult?.kpi_results.filter(k => k.execution_success) ?? [];
  }

  get failedKpis(): KpiExecutionResult[] {
    return this.executeResult?.kpi_results.filter(k => !k.execution_success) ?? [];
  }

  get specKpis() {
    return this.lastDashboard?.executive_summary_kpis ?? [];
  }

  getKpiValue(kpi: KpiExecutionResult): string {
    if (kpi.formatted_value) return kpi.formatted_value;
    if (kpi.value !== null && kpi.value !== undefined)
      return Number(kpi.value).toLocaleString(
        this.translocoService.getActiveLang() === 'fr' ? 'fr-FR' : 'en-US',
        { maximumFractionDigits: 2 }
      );
    return '—';
  }

  // Trouver la spec Gemini correspondant à un KPI calculé
  getKpiSpec(kpiName: string) {
    return this.specKpis.find(s => s.kpi_name === kpiName);
  }

  formatDate(iso: string): string {
    const locale = this.translocoService.getActiveLang() === 'fr' ? 'fr-FR' : 'en-US';
    return new Date(iso).toLocaleDateString(locale, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  getTrend(kpi: KpiExecutionResult): 'up' | 'down' | 'neutral' {
    // Placeholder — à connecter à une vraie logique de tendance plus tard
    if (!kpi.value) return 'neutral';
    return kpi.value > 0 ? 'up' : 'down';
  }
}
