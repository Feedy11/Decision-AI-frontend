import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Dataset } from '../models/Dataset.model';
import {
  CleaningProfile, CleaningProfileCreate, CleaningReport,
  DataQuality, DEFAULT_PROFILE, ValidationResult,
  ScanResult, ScanIssue, IssueType,
} from '../models/Cleaning.model';
import { CleaningService } from '../core/services/cleaning.service';
import { IaServicesService } from '../core/services/ia-services.service';
import { WorkflowService } from '../core/services/workflow.service';
import { ToastrService } from 'ngx-toastr';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import * as Highcharts from 'highcharts';

@Component({
  selector: 'app-cleaning',
  imports: [CommonModule, FormsModule, RouterModule, TranslocoPipe],
  templateUrl: './cleaning.component.html',
  styleUrl: './cleaning.component.css'
})
export class CleaningComponent implements OnInit, OnDestroy, AfterViewChecked {

  // ── View phase: 'scan' shows error sheet, 'repair' shows diff result ──
  phase: 'scan' | 'repair' = 'scan';

  // Tabs (Qualité / Profils / Historique unchanged)
  activeTab: 'clean' | 'profiles' | 'history' = 'clean';

  // Datasets
  datasets         : Dataset[] = [];
  selectedDatasetId: number | null = null;

  // Profils
  profiles          : CleaningProfile[] = [];
  selectedProfileId : number | null = null;
  showCreateProfile  = false;
  newProfile        : CleaningProfileCreate = { ...DEFAULT_PROFILE };

  // Scan (BEFORE cleaning)
  isScanning  = false;
  /** Workflow: wait for upload processing + scan (full-card loader). */
  isPreparingDataset = false;
  scanResult  : ScanResult | null = null;

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly POLL_INTERVAL_MS = 2000;
  private static readonly POLL_MAX_ATTEMPTS = 45;

  // Nettoyage (AFTER cleaning)
  saveAsNew    = false;
  isCleaning   = false;
  cleanResult  : CleaningReport | null = null;
  cleaningOptions: CleaningProfileCreate = { ...DEFAULT_PROFILE, name: 'Run options' };

  // Preview data
  previewData  : { columns: string[], rows: any[] } | null = null;
  oldPreviewData: { columns: string[], rows: any[] } | null = null;
  rawPreviewData: { columns: string[], rows: any[] } | null = null;
  showPreview  = false;
  repairOptionsOpen = true;

  // Validation
  isValidating     = false;
  validationResult : ValidationResult | null = null;

  // Qualité
  isLoadingQuality = false;
  qualityData      : DataQuality | null = null;

  // Historique
  isLoadingHistory = false;
  history          : CleaningReport[] = [];

  // Profils loading
  isLoadingProfiles = false;
  isSavingProfile   = false;

  // ── Chart ──
  private chartRendered       = false;
  private repairChartsRendered = false;
  Highcharts: typeof Highcharts = Highcharts;

  // ── Filter by issue type ──
  activeIssueFilter: string | null = null;

  // ── Pagination ──
  currentPage = 1;
  pageSize    = 10;

  constructor(
    private cleaningSvc: CleaningService,
    private iaService  : IaServicesService,
    private toastr     : ToastrService,
    private wf         : WorkflowService,
    private router     : Router,
    public translocoService: TranslocoService
  ) {}

  ngOnInit(): void {
    this.loadDatasets();
    this.loadProfiles();
  }

  ngOnDestroy(): void {
    this.clearPollTimer();
  }

  get isCleanPhaseLoading(): boolean {
    return this.isPreparingDataset || this.isScanning;
  }

  get cleanLoaderTitle(): string {
    const isFr = this.translocoService.getActiveLang() === 'fr';
    if (this.isScanning) return isFr ? 'Analyse des erreurs en cours…' : 'Analyzing errors in progress...';
    return isFr ? 'Préparation du dataset après import…' : 'Preparing dataset after import...';
  }

  get cleanLoaderHint(): string {
    const isFr = this.translocoService.getActiveLang() === 'fr';
    if (this.isScanning) {
      return isFr ? 'Détection des valeurs manquantes, doublons et aberrations.' : 'Detecting missing values, duplicates, and outliers.';
    }
    return isFr ? 'Le fichier est en cours de traitement. Cela peut prendre quelques instants.' : 'The file is being processed. This may take a moment.';
  }

  ngAfterViewChecked(): void {
    if (this.scanResult && !this.isScanning && !this.chartRendered) {
      this.renderPieChart();
    }
    if (this.phase === 'repair' && this.cleanResult && !this.repairChartsRendered) {
      this.renderRepairCharts();
    }
  }

  // ── Datasets ──────────────────────────────────────────────────────────
  private loadDatasets(): void {
    const wfId = this.router.url.includes('/workflow/') ? this.wf.getDatasetId() : null;

    if (wfId) {
      this.selectedDatasetId = wfId;
      this.isPreparingDataset = true;
      this.scanResult = null;
      this.pollDatasetUntilReady(wfId);
      return;
    }

    this.iaService.getMyDatasets(1, 100).subscribe({
      next: (res) => { this.datasets = res.datasets; },
      error: () => this.toastr.error(
        this.translocoService.translate('cleaning.toastr.loadDatasetsError'),
        this.translocoService.translate('common.error'),
        { timeOut: 4000 }
      ),
    });
  }

  private clearPollTimer(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Poll until backend finishes parsing the uploaded file, then auto-scan. */
  private pollDatasetUntilReady(datasetId: number, attempt = 0): void {
    this.clearPollTimer();
    this.iaService.getDatasetById(datasetId).subscribe({
      next: (ds) => {
        this.datasets = [ds];
        const status = String(ds.status ?? '').toLowerCase();

        if (status === 'processed') {
          this.loadScan();
          return;
        }
        if (status === 'failed') {
          this.isPreparingDataset = false;
          this.toastr.error(
            this.translocoService.translate('cleaning.toastr.pollFailed'),
            this.translocoService.translate('common.error'),
            { timeOut: 5000 },
          );
          return;
        }
        if (attempt >= CleaningComponent.POLL_MAX_ATTEMPTS) {
          this.isPreparingDataset = false;
          this.toastr.warning(
            this.translocoService.translate('cleaning.toastr.pollSlow'),
            'Info',
            { timeOut: 6000 },
          );
          return;
        }
        this.pollTimer = setTimeout(
          () => this.pollDatasetUntilReady(datasetId, attempt + 1),
          CleaningComponent.POLL_INTERVAL_MS,
        );
      },
      error: () => {
        this.isPreparingDataset = false;
        this.toastr.error(
          this.translocoService.translate('cleaning.toastr.loadDatasetError'),
          this.translocoService.translate('common.error'),
          { timeOut: 4000 }
        );
      },
    });
  }

  // ── Scan (phase 1) ────────────────────────────────────────────────────
  loadScan(): void {
    if (!this.selectedDatasetId) return;
    this.isScanning = true;
    this.scanResult = null;
    this.previewData = null;
    this.phase      = 'scan';

    // Fetch raw preview data
    this.cleaningSvc.getPreview(this.selectedDatasetId).subscribe({
      next: (data) => {
        this.previewData = data;
        this.rawPreviewData = data;
      },
      error: () => {}
    });

    // force=true is the default in CleaningService.scan() — always runs fresh
    this.cleaningSvc.scan(this.selectedDatasetId).subscribe({
      next: (r) => {
        this.isScanning = false;
        this.isPreparingDataset = false;
        this.clearPollTimer();
        this.scanResult = r;
        this.chartRendered = false; // re-render chart
        this.activeIssueFilter = null;
        this.currentPage = 1;

        if (r.total_issues === 0) {
          this.toastr.success(
            this.translocoService.translate('cleaning.toastr.scanSuccessClean'),
            'Scan ✓', { timeOut: 3000, progressBar: true }
          );
        } else {
          this.toastr.warning(
            this.translocoService.translate('cleaning.toastr.scanSuccessIssues', { count: r.total_issues }),
            this.translocoService.translate('cleaning.toastr.scanSuccessTitle'),
            { timeOut: 4000, progressBar: true }
          );
        }
      },
      error: () => {
        this.isScanning = false;
        this.isPreparingDataset = false;
        this.clearPollTimer();
        this.toastr.error(
          this.translocoService.translate('cleaning.toastr.scanError'),
          this.translocoService.translate('common.error'),
          { timeOut: 4000, progressBar: true }
        );
      }
    });
  }

  // ── Repair / Clean (phase 2) ──────────────────────────────────────────
  fillIdentifiersUnknown = false; // Checkbox state

  cleanDataset(): void {
    if (!this.selectedDatasetId) return;
    this.isCleaning  = true;
    this.cleanResult = null;
    this.oldPreviewData = this.rawPreviewData ?? this.previewData;
    this.previewData = null;
    this.showPreview = false;

    this.cleaningSvc.cleanDataset(
      this.selectedDatasetId,
      this.selectedProfileId ?? undefined,
      this.saveAsNew,
      this.fillIdentifiersUnknown ? 'fill_unknown' : 'drop',
      this.buildCleaningOverrides()
    ).subscribe({
      next: (r) => {
        this.isCleaning  = false;
        this.cleanResult = r;
        this.phase       = 'repair';   // ← switch to diff view
        this.repairChartsRendered = false; // reset for re-render
        this.toastr.success(
          this.translocoService.translate('cleaning.toastr.cleanSuccess', { deleted: r.rows_before - r.rows_after }),
          this.translocoService.translate('cleaning.toastr.cleanSuccessTitle'),
          { timeOut: 5000, progressBar: true }
        );
        this.wf.completeCurrentStep();
        
        // Fetch raw preview data for the repaired dataset
        this.cleaningSvc.getPreview(r.dataset_id).subscribe({
          next: (data) => this.previewData = data,
          error: () => {}
        });
      },
      error: (err) => {
        this.isCleaning = false;
        this.toastr.error(
          err.error?.detail || (this.translocoService.getActiveLang() === 'fr' ? 'Erreur de nettoyage.' : 'Error during cleaning.'),
          this.translocoService.translate('common.error'),
          { timeOut: 5000, progressBar: true }
        );
      }
    });
  }

  // ── Tab / phase helpers ───────────────────────────────────────────────
  setTab(tab: 'clean' | 'profiles' | 'history'): void {
    this.activeTab = tab;
    if (tab === 'profiles') this.loadProfiles();
    if (tab === 'history') this.loadHistory();
  }

  goBackToScan(): void {
    this.phase              = 'scan';
    this.cleanResult        = null;
    this.repairChartsRendered = false;
    if (this.selectedDatasetId) {
       this.loadScan();
    }
  }

  // ── Profils ───────────────────────────────────────────────────────────
  loadProfiles(): void {
    this.isLoadingProfiles = true;
    this.cleaningSvc.getProfiles().subscribe({
      next : (p) => { this.profiles = p; this.isLoadingProfiles = false; },
      error: () => { this.isLoadingProfiles = false; }
    });
  }

  syncCleaningOptionsFromProfile(profileId: number | null): void {
    const profile = profileId ? this.profiles.find(p => p.id === profileId) : null;
    this.cleaningOptions = profile
      ? { ...profile }
      : { ...DEFAULT_PROFILE, name: 'Run options' };
  }

  private buildCleaningOverrides(): Partial<CleaningProfileCreate> {
    return {
      handle_missing: this.cleaningOptions.handle_missing,
      missing_fill_strategy: this.cleaningOptions.missing_fill_strategy,
      missing_fill_value: this.cleaningOptions.missing_fill_value,
      remove_duplicates: this.cleaningOptions.remove_duplicates,
      fix_data_types: this.cleaningOptions.fix_data_types,
      detect_outliers: this.cleaningOptions.detect_outliers,
      outlier_method: this.cleaningOptions.outlier_method,
      outlier_threshold: this.cleaningOptions.outlier_threshold,
      outlier_action: this.cleaningOptions.outlier_action,
      strip_whitespace: this.cleaningOptions.strip_whitespace,
      standardize_text: this.cleaningOptions.standardize_text,
      standardize_dates: this.cleaningOptions.standardize_dates,
      date_format: this.cleaningOptions.date_format,
      normalize_numeric: this.cleaningOptions.normalize_numeric,
      normalization_method: this.cleaningOptions.normalization_method,
    };
  }

  createProfile(): void {
    if (!this.newProfile.name.trim()) return;
    this.isSavingProfile = true;

    this.cleaningSvc.createProfile(this.newProfile).subscribe({
      next: (p) => {
        this.isSavingProfile   = false;
        this.showCreateProfile = false;
        this.profiles          = [p, ...this.profiles];
        this.newProfile        = { ...DEFAULT_PROFILE };
        this.toastr.success(
          this.translocoService.translate('cleaning.toastr.profileCreated', { name: p.name }),
          this.translocoService.translate('common.success'),
          { timeOut: 3000, progressBar: true }
        );
      },
      error: () => {
        this.isSavingProfile = false;
        this.toastr.error(
          this.translocoService.translate('cleaning.toastr.profileCreateError'),
          this.translocoService.translate('common.error'),
          { timeOut: 4000, progressBar: true }
        );
      }
    });
  }

  deleteProfile(id: number, name: string): void {
    this.cleaningSvc.deleteProfile(id).subscribe({
      next: () => {
        this.profiles = this.profiles.filter(p => p.id !== id);
        this.toastr.success(
          this.translocoService.translate('cleaning.toastr.profileDeleted', { name }),
          this.translocoService.getActiveLang() === 'fr' ? 'Supprimé' : 'Deleted',
          { timeOut: 3000, progressBar: true }
        );
      },
      error: () => {
        this.toastr.error(
          this.translocoService.translate('cleaning.toastr.profileDeleteError'),
          this.translocoService.translate('common.error'),
          { timeOut: 4000, progressBar: true }
        );
      }
    });
  }

  // ── Validation ────────────────────────────────────────────────────────
  validateDataset(): void {
    if (!this.selectedDatasetId) return;
    this.isValidating     = true;
    this.validationResult = null;

    this.cleaningSvc.validateDataset(this.selectedDatasetId).subscribe({
      next: (r) => {
        this.isValidating     = false;
        this.validationResult = r;
        const msg = r.valid
          ? this.translocoService.translate('cleaning.toastr.validationSuccess')
          : this.translocoService.translate('cleaning.toastr.validationErrors', { count: r.errors.length });
        r.valid
          ? this.toastr.success(msg, 'Validation', { timeOut: 3000, progressBar: true })
          : this.toastr.warning(msg, 'Validation', { timeOut: 4000, progressBar: true });
      },
      error: () => {
        this.isValidating = false;
        this.toastr.error(
          this.translocoService.translate('cleaning.toastr.validationError'),
          this.translocoService.translate('common.error'),
          { timeOut: 4000, progressBar: true }
        );
      }
    });
  }

  // ── Qualité ───────────────────────────────────────────────────────────
  loadQuality(): void {
    if (!this.selectedDatasetId) return;
    this.isLoadingQuality = true;
    this.qualityData      = null;

    this.cleaningSvc.getQuality(this.selectedDatasetId).subscribe({
      next : (q) => { this.isLoadingQuality = false; this.qualityData = q; },
      error: () => {
        this.isLoadingQuality = false;
        this.toastr.error(
          this.translocoService.translate('cleaning.toastr.qualityError'),
          this.translocoService.translate('common.error'),
          { timeOut: 4000, progressBar: true }
        );
      }
    });
  }

  // ── Historique ────────────────────────────────────────────────────────
  loadHistory(): void {
    if (!this.selectedDatasetId) return;
    this.isLoadingHistory = true;

    this.cleaningSvc.getCleaningHistory(this.selectedDatasetId).subscribe({
      next : (h) => { this.isLoadingHistory = false; this.history = h; },
      error: () => { this.isLoadingHistory = false; }
    });
  }

  // ── Template helpers ──────────────────────────────────────────────────
  getMissingCols(): { name: string; count: number }[] {
    if (!this.qualityData) return [];
    return Object.entries(this.qualityData.missing_values.by_column)
      .map(([name, count]) => ({ name, count }));
  }

  issueIcon(type: IssueType | string): string {
    const m: Record<string, string> = {
      missing      : '⬜',
      missing_token: '🔤',
      outlier      : '📊',
      duplicate    : '🔁',
    };
    return m[type] ?? '⚠️';
  }

  issueLabel(type: IssueType | string): string {
    const isFr = this.translocoService.getActiveLang() === 'fr';
    const m: Record<string, string> = {
      missing      : isFr ? 'Manquant' : 'Missing',
      missing_token: isFr ? 'Token nul' : 'Null token',
      outlier      : isFr ? 'Aberrant' : 'Outlier',
      duplicate    : isFr ? 'Doublon' : 'Duplicate',
    };
    return m[type] ?? type;
  }

  changeIcon(type: string): string {
    const m: Record<string, string> = {
      filled_missing       : '🔄',
      text_stripped        : '✂️',
      text_normalized      : '🔡',
      value_capped         : '🔒',
      set_to_missing       : '⬜',
      row_removed          : '🗑️',
      row_removed_duplicate: '🔁',
      modified             : '✏️',
    };
    return m[type] ?? '✏️';
  }

  operationInfo(op: string): { icon: string; label: string; desc: string } {
    const isFr = this.translocoService.getActiveLang() === 'fr';
    const m: Record<string, { icon: string; label: string; desc: string }> = {
      text_cleaning       : { icon: '✂️', label: isFr ? 'Nettoyage texte' : 'Text cleaning',      desc: isFr ? 'Espaces supprimés, casse uniformisée' : 'Whitespace trimmed, casing normalized' },
      data_types          : { icon: '🔢', label: isFr ? 'Types corrigés' : 'Types fixed',        desc: isFr ? 'Textes convertis en nombres ou dates' : 'Texts converted to numbers or dates' },
      outliers            : { icon: '📊', label: isFr ? 'Valeurs aberrantes' : 'Outliers handled',    desc: isFr ? 'Anomalies détectées et traitées' : 'Anomalies detected and handled' },
      missing_values      : { icon: '🕳️', label: isFr ? 'Valeurs manquantes' : 'Missing values',    desc: isFr ? 'Cellules vides remplies ou lignes supprimées' : 'Empty cells filled or rows removed' },
      duplicates          : { icon: '🔁', label: isFr ? 'Doublons supprimés' : 'Duplicates removed',    desc: isFr ? 'Lignes identiques retirées du dataset' : 'Identical rows removed from dataset' },
      date_standardization: { icon: '📅', label: isFr ? 'Dates standardisées' : 'Dates standardized',   desc: isFr ? 'Format de date uniformisé (YYYY-MM-DD)' : 'Date format standardized (YYYY-MM-DD)' },
      missing_tokens      : { icon: '🔤', label: isFr ? 'Tokens nuls nettoyés' : 'Null tokens cleaned',  desc: isFr ? 'Valeurs "na", "?", "--" converties en vide' : 'Values like "na", "?", "--" converted to empty' },
    };
    return m[op] ?? { icon: '⚙️', label: op, desc: isFr ? 'Opération de nettoyage' : 'Cleaning operation' };
  }

  /** Check if a cleaning operation actually had an impact (used for badge green state) */
  isOperationPerformed(operation: string): boolean {
    if (!this.cleanResult) return false;
    const r = this.cleanResult;
    const changes = r.cleaning_report?.['changes'] ?? {};

    switch (operation) {
      case 'missing_values':
        return (r.missing_values_handled ?? 0) > 0;
      case 'duplicates':
        return (r.duplicates_removed ?? 0) > 0;
      case 'outliers':
        return (r.outliers_detected ?? 0) > 0;
      case 'data_types':
        return (r.data_types_fixed ?? 0) > 0;
      case 'text_cleaning': {
        const tc = changes['text_cleaning'];
        if (tc && (tc['cells_modified'] > 0 || tc['columns_cleaned']?.length > 0)) return true;
        // Fallback: check rows_before vs rows_after isn't enough — check report for strip/normalize
        const strips = this.diffRows.filter(d => d.change_type === 'text_stripped' || d.change_type === 'text_normalized');
        return strips.length > 0;
      }
      case 'date_standardization': {
        const ds = changes['date_standardization'];
        if (ds && (ds['columns_standardized']?.length > 0 || ds['dates_converted'] > 0)) return true;
        return false;
      }
      default:
        return false;
    }
  }

  // ── Chart rendering ──────────────────────────────────────────────────
  private renderPieChart(): void {
    const container = document.getElementById('error-pie-chart');
    if (!container || !this.scanResult) return;
    this.chartRendered = true;

    const s = this.scanResult.summary;
    const total = this.scanResult.total_issues;
    const totalRows = this.scanResult.issues?.length
      ? Math.max(...this.scanResult.issues.map(i => i.row_number ?? 0), 0)
      : 0;

    const missingCount  = s['missing'] ?? 0;
    const tokenCount    = s['missing_token'] ?? 0;
    const outlierCount  = s['outlier'] ?? 0;
    const dupCount      = s['duplicate'] ?? 0;
    const cleanCount    = Math.max(1, (totalRows || total + 10) - total);
    const self = this;

    const isFr = this.translocoService.getActiveLang() === 'fr';
    const cleanLabel = isFr ? 'Données propres' : 'Clean data';
    const missingLabel = isFr ? 'Manquantes' : 'Missing';
    const tokenLabel = isFr ? 'Tokens nuls' : 'Null tokens';
    const outlierLabel = isFr ? 'Aberrantes' : 'Outliers';
    const dupLabel = isFr ? 'Dupliquées' : 'Duplicates';

    Highcharts.chart(container, {
      chart: {
        type: 'pie',
        backgroundColor: 'transparent',
        height: 260,
        margin: [8, 8, 8, 8],
        style: { fontFamily: 'inherit' }
      },
      title:   { text: '' },
      credits: { enabled: false },
      accessibility: { point: { valueSuffix: '%' } },
      tooltip: {
        headerFormat: '',
        pointFormat: isFr
          ? '<span style="color:{point.color}">●</span> <b>{point.name}</b><br/>Quantité: <b>{point.y}</b> ({point.percentage:.1f}%)'
          : '<span style="color:{point.color}">●</span> <b>{point.name}</b><br/>Quantity: <b>{point.y}</b> ({point.percentage:.1f}%)',
        style: { fontSize: '12px' }
      },
      plotOptions: {
        pie: {
          innerSize: '55%',
          allowPointSelect: true,
          cursor: 'pointer',
          borderWidth: 2,
          borderColor: '#fff',
          slicedOffset: 8,
          dataLabels: {
            enabled: true,
            format: '{point.percentage:.1f}%',
            distance: 14,
            style: {
              fontSize: '10px',
              fontWeight: '700',
              color: '#475569',
              textOutline: 'none'
            },
            filter: { property: 'percentage', operator: '>', value: 5 }
          },
          showInLegend: false,
          point: {
            events: {
              click: function (this: any) {
                const filterKey = this.options?.filterKey ?? null;
                self.setIssueFilter(filterKey);
              }
            }
          }
        }
      },
      series: [{
        type: 'pie' as any,
        name: isFr ? 'Données' : 'Data',
        data: [
          { name: cleanLabel,    y: cleanCount,   color: '#22C55E', filterKey: null,             sliced: false },
          ...(missingCount > 0  ? [{ name: missingLabel,   y: missingCount,  color: '#EF4444', filterKey: 'missing'       }] : []),
          ...(tokenCount   > 0  ? [{ name: tokenLabel,  y: tokenCount,    color: '#F59E0B', filterKey: 'missing_token' }] : []),
          ...(outlierCount > 0  ? [{ name: outlierLabel,   y: outlierCount,  color: '#8B5CF6', filterKey: 'outlier'       }] : []),
          ...(dupCount     > 0  ? [{ name: dupLabel,   y: dupCount,      color: '#3B82F6', filterKey: 'duplicate'     }] : []),
        ]
      }] as any
    });
  }

  // ── Repair bar charts ────────────────────────────────────────────────────
  private renderRepairCharts(): void {
    const c1 = document.getElementById('chart-avant');
    const c2 = document.getElementById('chart-apres');
    // Guard: DOM elements must exist — if not, do NOT mark as rendered so we retry next tick
    if (!c1 || !c2 || !this.cleanResult) return;
    this.repairChartsRendered = true;  // only mark done AFTER confirming DOM is ready

    // Destroy any previous Highcharts instances living inside these containers
    // so Highcharts doesn't complain about re-using a container.
    // Use (c as any).renderTo because Highcharts typings don't expose it publicly.
    Highcharts.charts
      .filter((c): c is Highcharts.Chart => !!c)
      .filter(c => (c as any).renderTo === c1 || (c as any).renderTo === c2)
      .forEach(c => c.destroy());

    const r = this.cleanResult;
    const isFr = this.translocoService.getActiveLang() === 'fr';
    const categories = isFr 
      ? ['Lignes', 'Manquants', 'Doublons', 'Outliers', 'Types']
      : ['Rows', 'Missing', 'Duplicates', 'Outliers', 'Types'];

    // Avant data
    const avantData = [
      { y: r.rows_before,            color: '#64748B' },
      { y: r.missing_values_handled, color: '#EF4444' },
      { y: r.duplicates_removed,     color: '#3B82F6' },
      { y: r.outliers_detected,      color: '#8B5CF6' },
      { y: r.data_types_fixed,       color: '#F59E0B' },
    ];

    // Après data
    const apresData = [
      { y: r.rows_after,                                  color: '#22C55E' },
      { y: 0,                                             color: '#86EFAC' },
      { y: 0,                                             color: '#93C5FD' },
      { y: 0,                                             color: '#C4B5FD' },
      { y: 0,                                             color: '#FCD34D' },
    ];

    const sharedOptions: Highcharts.Options = {
      chart: {
        type: 'bar', backgroundColor: 'transparent',
        height: 200, margin: [10, 20, 30, 10],
        style: { fontFamily: 'inherit' }
      },
      title:   { text: '' },
      credits: { enabled: false },
      legend:  { enabled: false },
      xAxis: {
        categories,
        labels: { style: { fontSize: '11px', fontWeight: '600', color: '#475569' } },
        lineColor: '#E2E8F0', tickColor: '#E2E8F0'
      },
      yAxis: {
        title: { text: '' },
        gridLineColor: '#F1F5F9',
        labels: { style: { fontSize: '10px', color: '#94A3B8' } }
      },
      tooltip: {
        headerFormat: '<b>{point.key}</b><br/>',
        pointFormat: isFr ? 'Quantité : <b>{point.y}</b>' : 'Quantity: <b>{point.y}</b>',
        style: { fontSize: '12px' }
      },
      plotOptions: {
        bar: {
          borderRadius: 5,
          dataLabels: {
            enabled: true,
            style: { fontSize: '10px', fontWeight: '700', color: '#475569', textOutline: 'none' }
          }
        }
      }
    };

    Highcharts.chart(c1, { ...sharedOptions, series: [{ type: 'bar', data: avantData } as any] });
    Highcharts.chart(c2, { ...sharedOptions, series: [{ type: 'bar', data: apresData } as any] });
  }

  // ── Repair preview toggle ────────────────────────────────────────────
  showRepairPreview(show: boolean): void {
    this.showPreview = show;
    if (!show) {
      // Reset the flag so the charts will be re-rendered
      this.repairChartsRendered = false;
      // Use setTimeout(0) to push rendering past the current Angular change-detection
      // cycle — the *ngIf block containing #chart-avant/#chart-apres needs one full
      // tick to appear in the DOM before Highcharts can render into it.
      setTimeout(() => {
        this.repairChartsRendered = false; // ensure it's still false after the tick
        this.renderRepairCharts();
      }, 0);
    }
  }

  // ── Issue filter ──────────────────────────────────────────────────────
  setIssueFilter(type: string | null): void {
    this.activeIssueFilter = (this.activeIssueFilter === type) ? null : type;
    this.currentPage = 1;
  }

  get filteredIssues(): ScanIssue[] {
    if (!this.scanResult) return [];
    if (!this.activeIssueFilter) return this.scanResult.issues;
    return this.scanResult.issues.filter(i => i.issue_type === this.activeIssueFilter);
  }

  // ── Pagination ────────────────────────────────────────────────────────
  get totalFilteredIssues(): number {
    return this.filteredIssues.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalFilteredIssues / this.pageSize));
  }

  get paginatedIssues(): ScanIssue[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredIssues.slice(start, start + this.pageSize);
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  formatDate(iso: string): string {
    const isFr = this.translocoService.getActiveLang() === 'fr';
    return new Date(iso).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // Build a flat diff list from cleanResult.cleaning_report
  get diffRows(): any[] {
    if (!this.cleanResult?.cleaning_report) return [];
    const changes = this.cleanResult.cleaning_report['changes'] ?? {};
    const rows: any[] = [];

    // missing values filled
    const mv = changes['missing_values'];
    const isFr = this.translocoService.getActiveLang() === 'fr';
    if (mv?.missing_before) {
      Object.entries(mv.missing_before as Record<string, number>).forEach(([col, cnt]) => {
        const after = (mv.missing_after ?? {})[col] ?? 0;
        const filled = (cnt as number) - after;
        if (filled > 0) {
          rows.push({
            row_number : '—',
            column     : col,
            change_type: 'filled_missing',
            before     : isFr ? `${cnt} valeur(s) nulle(s)` : `${cnt} null value(s)`,
            after      : isFr ? `${filled} remplie(s) (${mv.fill_strategy ?? 'auto'})` : `${filled} filled (${mv.fill_strategy ?? 'auto'})`,
          });
        }
      });
    }

    // duplicates
    const dup = changes['duplicates'];
    if (dup?.duplicates_removed > 0) {
      rows.push({
        row_number : '—',
        column     : isFr ? '(lignes)' : '(rows)',
        change_type: 'row_removed_duplicate',
        before     : isFr ? `${dup.duplicates_found} doublon(s) trouvé(s)` : `${dup.duplicates_found} duplicate(s) found`,
        after      : isFr ? `${dup.duplicates_removed} supprimé(s)` : `${dup.duplicates_removed} deleted`,
      });
    }

    // outliers
    const out = changes['outliers'];
    if (out?.total_outliers > 0) {
      Object.entries(out.outliers_by_column ?? {}).forEach(([col, cnt]) => {
        rows.push({
          row_number : '—',
          column     : col,
          change_type: out.action === 'cap' ? 'value_capped' : 'row_removed',
          before     : isFr ? `${cnt} aberrant(s)` : `${cnt} outlier(s)`,
          after      : `action: ${out.action}`,
        });
      });
    }

    // data types
    const dt = changes['data_types'];
    if (dt?.changes) {
      Object.entries(dt.changes as Record<string, any>).forEach(([col, info]: any) => {
        rows.push({
          row_number : '—',
          column     : col,
          change_type: 'modified',
          before     : info.from,
          after      : info.to,
        });
      });
    }

    return rows;
  }

  getOldCellValue(row: any, col: string, index: number): any {
    if (!this.oldPreviewData || !this.oldPreviewData.rows) return null;
    const missingStrategy = this.cleanResult?.cleaning_report?.['changes']?.['missing_values']?.['strategy'];
    if (missingStrategy === 'drop') return null;

    const normalizeValue = (val: any): string => {
      if (val === null || val === undefined) return '';
      return String(val).trim().toLowerCase();
    };

    const isDifferent = (oldVal: any, newVal: any): boolean => {
      if (oldVal === newVal) return false;
      if (oldVal === null || oldVal === undefined || newVal === null || newVal === undefined) {
        return oldVal !== newVal;
      }

      const oldText = String(oldVal).trim();
      const newText = String(newVal).trim();

      // Ignore type-only changes such as "0.19" -> 0.19.
      if (oldText !== '' && newText !== '' && !isNaN(Number(oldText)) && !isNaN(Number(newText))) {
        return Math.abs(Number(oldText) - Number(newText)) > 1e-9;
      }

      // Ignore pure case changes (uppercase ↔ lowercase)
      if (oldText.toLowerCase() === newText.toLowerCase()) return false;
      return true;
    };

    const findOldRowByKey = (): any | null => {
      const oldColumns = new Set(this.oldPreviewData?.columns ?? []);
      const candidates = Object.keys(row).filter(k => oldColumns.has(k));
      const stableKeys = candidates.filter(k => {
        const lower = k.toLowerCase();
        return lower === 'id' || lower.endsWith('_id') || lower === 'date' || lower.includes('date');
      });

      for (const key of stableKeys) {
        const rowValue = normalizeValue(row[key]);
        if (!rowValue) continue;

        const oldRow = this.oldPreviewData?.rows.find(r => normalizeValue(r[key]) === rowValue);
        if (oldRow) return oldRow;
      }

      return null;
    };

    // 1. Try matching by a stable key (ID/date/etc.). This avoids marking
    // row-deletion shifts as cell edits in the cleaned preview.
    const isFr = this.translocoService.getActiveLang() === 'fr';
    const keyedOldRow = findOldRowByKey();
    if (keyedOldRow) {
      if (isDifferent(keyedOldRow[col], row[col])) {
        return keyedOldRow[col] !== null ? keyedOldRow[col] : (isFr ? 'vide' : 'empty');
      }
      return null;
    }

    // 2. Fallback to index matching only when row counts did not change.
    if (this.cleanResult && this.cleanResult.rows_before !== this.cleanResult.rows_after) {
      return null;
    }

    const oldRow = this.oldPreviewData.rows[index];
    if (oldRow && isDifferent(oldRow[col], row[col])) {
      return oldRow[col] !== null ? oldRow[col] : (isFr ? 'vide' : 'empty');
    }
    return null;
  }

  /** Format a value for display: numbers get 2 decimal places if they have decimals */
  formatCellValue(val: any): string {
    const isFr = this.translocoService.getActiveLang() === 'fr';
    if (val === null || val === undefined) return isFr ? 'vide' : 'empty';
    if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '')) {
      const n = Number(val);
      if (!Number.isInteger(n)) {
        return n.toFixed(2);
      }
    }
    return String(val);
  }
}
