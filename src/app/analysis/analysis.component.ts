import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Dataset } from '../models/Dataset.model';
import { AnalysisResult, PerDatasetStatisticalResult, Relationship, SimpleRelationshipResponse, StatisticalAnalyticsResponse } from '../models/Analysis.model';
import { AnalysisService } from '../core/services/analysis.service';
import { IaServicesService } from '../core/services/ia-services.service';
import { WorkflowService } from '../core/services/workflow.service';
import { ToastrService } from 'ngx-toastr';
import { LucideAngularModule } from 'lucide-angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-analysis',
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule, TranslocoPipe],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.css'
})
export class AnalysisComponent implements OnInit {

  //Tabs
  activeTab: 'analyze' | 'kpi' | 'relationships' | 'statistical' = 'analyze';

  //Datasets
  datasets          : Dataset[]  = [];
  selectedDatasetId : number | null = null;
  selectedDatasetIds: number[]   = [];   // pour statistical (multi)

  // Résultats
  analysisResult    : AnalysisResult | null = null;
  simpleRel         : SimpleRelationshipResponse | null = null;
  statisticalResult : StatisticalAnalyticsResponse | null = null;

  // UI states
  isAnalyzing       = false;
  isLoadingAnalysis = false;
  isLoadingRel      = false;
  isLoadingStat     = false;
  isDeletingAnalysis= false;
  forceReanalyze    = false;

  // ── Filtre relations ──────────────────────────────────────
  filterType        = 'all';   // all | predictive | correlation | hierarchy
  minStrength       = 0;

  constructor(
    private analysisSvc: AnalysisService,
    private iaService  : IaServicesService,
    private toastr     : ToastrService,
    private wf         : WorkflowService,
    private router     : Router,
    public translocoService: TranslocoService
  ) {}

  ngOnInit(): void {
    this.loadDatasets();
  }

  private loadDatasets(): void {
    this.iaService.getMyDatasets(1, 100).subscribe({
      next : (res) => { 
        if (this.router.url.includes('/workflow/')) {
          const wfDatasetId = this.wf.getDatasetId();
          if (wfDatasetId) {
            this.datasets = res.datasets.filter(d => d.id === wfDatasetId);
            this.selectedDatasetId = wfDatasetId;
            // Also select it for statistical (multi-id array)
            if (!this.selectedDatasetIds.includes(wfDatasetId)) {
              this.selectedDatasetIds.push(wfDatasetId);
            }
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

  setTab(tab: 'analyze' | 'kpi' | 'relationships' | 'statistical'): void {
    this.activeTab = tab;
  }

  runAnalysis(): void {
    if (!this.selectedDatasetId) return;
    this.isAnalyzing    = true;
    this.analysisResult = null;

    this.analysisSvc.analyzeDataset(this.selectedDatasetId, this.forceReanalyze).subscribe({
        next: (r) => {
          this.isAnalyzing    = false;
          this.analysisResult = r;
          this.toastr.success(
            this.translocoService.translate('analysis.toastr.successMsg', { count: r.total_relationships, confidence: Math.round(r.confidence_score * 100) + '%' }),
            this.translocoService.translate('analysis.toastr.successTitle'),
            { timeOut: 5000, progressBar: true }
          );
          // Unlock next workflow step
          this.wf.completeCurrentStep();
        },
        error: (err) => {
          this.isAnalyzing = false;
          this.toastr.error(
            err.error?.detail || this.translocoService.translate('analysis.toastr.errorMsg'),
            this.translocoService.translate('common.error'),
            { timeOut: 5000, progressBar: true }
          );
        }
    });
  }

  loadExistingAnalysis(): void {
    if (!this.selectedDatasetId) return;
    this.isLoadingAnalysis = true;
    this.analysisResult    = null;

    this.analysisSvc.getAnalysis(this.selectedDatasetId).subscribe({
      next : (r) => { this.isLoadingAnalysis = false; this.analysisResult = r; },
        error: (err) => {
          this.isLoadingAnalysis = false;
          const msg = err.status === 404
            ? this.translocoService.translate('analysis.toastr.noAnalysis')
            : this.translocoService.translate('analysis.toastr.loadError');
          this.toastr.warning(msg, 'Info', { timeOut: 4000, progressBar: true });
        }
    });
  }
  deleteAnalysis(): void {
    if (!this.selectedDatasetId || !this.analysisResult) return;
    this.isDeletingAnalysis = true;

    this.analysisSvc.deleteAnalysis(this.selectedDatasetId).subscribe({
        next: () => {
          this.isDeletingAnalysis = false;
          this.analysisResult     = null;
          this.toastr.success(
            this.translocoService.translate('analysis.toastr.deleteSuccess'),
            this.translocoService.getActiveLang() === 'fr' ? 'Supprimé' : 'Deleted',
            { timeOut: 3000, progressBar: true }
          );
        },
        error: () => {
          this.isDeletingAnalysis = false;
          this.toastr.error(
            this.translocoService.translate('analysis.toastr.deleteError'),
            this.translocoService.translate('common.error'),
            { timeOut: 3000, progressBar: true }
          );
        }
    });
  }


  loadRelationships(): void {
    if (!this.selectedDatasetId) return;
    this.isLoadingRel = true;
    this.simpleRel    = null;

    this.analysisSvc.getRelationships(this.selectedDatasetId).subscribe({
      next : (r) => { this.isLoadingRel = false; this.simpleRel = r; },
        error: (err) => {
          this.isLoadingRel = false;
          const msg = err.status === 404
            ? this.translocoService.translate('analysis.toastr.noAnalysis')
            : this.translocoService.translate('analysis.toastr.loadError');
          this.toastr.warning(msg, 'Info', { timeOut: 4000, progressBar: true });
        }
    });
  }


  runStatistical(): void {
    if (this.selectedDatasetIds.length === 0) return;
    this.isLoadingStat     = true;
    this.statisticalResult = null;

    this.analysisSvc.getStatisticalRelationships(this.selectedDatasetIds).subscribe({
        next: (r) => {
          this.isLoadingStat     = false;
          this.statisticalResult = r;
          const total = r.per_dataset.reduce((s, d) => s + d.total_meaningful, 0);
          this.toastr.success(
            this.translocoService.translate('analysis.toastr.statSuccessMsg', { count: total }),
            this.translocoService.translate('analysis.toastr.statSuccessTitle'),
            { timeOut: 5000, progressBar: true }
          );
        },
        error: () => {
          this.isLoadingStat = false;
          this.toastr.error(
            this.translocoService.translate('analysis.toastr.statErrorMsg'),
            this.translocoService.translate('common.error'),
            { timeOut: 5000, progressBar: true }
          );
        }
    });
  }


  toggleDatasetSelection(id: number): void {
    const idx = this.selectedDatasetIds.indexOf(id);
    if (idx >= 0) this.selectedDatasetIds.splice(idx, 1);
    else          this.selectedDatasetIds.push(id);
  }

  isSelected(id: number): boolean {
    return this.selectedDatasetIds.includes(id);
  }

  // Helpers relations filtrées
  get filteredRelationships(): Relationship[] {
    if (!this.analysisResult) return [];
    return this.analysisResult.relationships.filter(r => {
      const typeOk     = this.filterType === 'all' || r.type === this.filterType;
      const strengthOk = r.strength >= this.minStrength;
      return typeOk && strengthOk;
    }).sort((a, b) => b.strength - a.strength);
  }

  getStrengthClass(s: number): string {
    if (s >= 0.7) return 'strength-high';
    if (s >= 0.4) return 'strength-mid';
    return 'strength-low';
  }

  getTypeClass(t: string): string {
    const map: Record<string, string> = {
      predictive : 'type-predictive',
      correlation: 'type-correlation',
      hierarchy  : 'type-hierarchy'
    };
    return map[t] ?? '';
  }

  getTypeLabel(t: string): string {
    const isFr = this.translocoService.getActiveLang() === 'fr';
    const map: Record<string, string> = {
      predictive : isFr ? '🎯 Prédictif' : '🎯 Predictive',
      correlation: isFr ? '📈 Corrélation' : '📈 Correlation',
      hierarchy  : isFr ? '🗂️ Hiérarchie' : '🗂️ Hierarchy'
    };
    return map[t] ?? t;
  }

  getChartIcon(suggestion?: string | null): string {
    const map: Record<string, string> = {
      scatter   : '⬡',
      bar       : '▊',
      line      : '〰',
      pie       : '◕',
      heatmap   : '⬛',
      box       : '▭',
      histogram : '▬',
    };
    return suggestion ? (map[suggestion] ?? '📊') : '📊';
  }

  formatConfidence(score: number): string {
    return `${Math.round(score * 100)}%`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  getStatBlock(block: PerDatasetStatisticalResult): string {
    return this.datasets.find(d => d.id === block.dataset_id)?.original_filename ?? `Dataset #${block.dataset_id}`;
  }

  getTrendPct(val: number, series: { value: number }[]): number {
    const max = Math.max(...series.map(s => s.value));
    return max > 0 ? (val / max) * 100 : 0;
  }

  getDimPct(val: number, items: { value: number }[]): number {
    const max = Math.max(...items.map(i => i.value));
    return max > 0 ? (val / max) * 100 : 0;
  }
}
