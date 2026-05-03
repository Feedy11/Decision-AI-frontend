import {
  Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef
} from '@angular/core';
import { CommonModule }     from '@angular/common';
import { FormsModule }      from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService }    from 'ngx-toastr';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { ReportService }    from '../core/services/report.service';
import { IaServicesService } from '../core/services/ia-services.service';
import { ChatService }      from '../core/services/chat.service';
import { Dataset }           from '../models/Dataset.model';
import { Conversation }      from '../models/chat.model';
import {
  ReportDocument,
  ReportStep,
  PipelineStepUI,
  ActionableRecommendation,
  ReportSource,
  WhatHappened,
  WhyItHappened
} from '../models/Report.model';

@Component({
  selector   : 'app-report',
  standalone : true,
  imports    : [CommonModule, FormsModule],
  templateUrl: './report.component.html',
  styleUrl   : './report.component.css'
})
export class ReportComponent implements OnInit, OnDestroy {

  // ── Dataset & Conversation selection ──────────────────────
  datasets          : Dataset[]      = [];
  conversations     : Conversation[] = [];
  selectedDatasetId : number | null  = null;
  selectedConvId    : number | null  = null;
  includeWebContext = true;

  // ── Pipeline steps UI ─────────────────────────────────────
  pipelineSteps: PipelineStepUI[] = [];

  // ── Report state ──────────────────────────────────────────
  report        : ReportDocument | null = null;
  reportId      : string | null = null;
  datasetName   : string = '';
  latencyMs     : number = 0;

  // Section streaming buffers
  whatHappenedText   = '';
  whyItHappenedText  = '';
  whatToDoText        = '';
  whatToAvoidText     = '';

  // Parsed sections (from report_section events)
  whatHappened   : WhatHappened | null   = null;
  whyItHappened : WhyItHappened | null  = null;
  whatToDo      : ActionableRecommendation[] = [];
  whatToAvoid   : string[] = [];

  // ── UI states ─────────────────────────────────────────────
  isGenerating  = false;
  isComplete    = false;
  isExporting   = false;
  hasError      = false;
  errorMessage  = '';
  activeSection : 'what_happened' | 'why' | 'what_to_do' | 'sources' = 'what_happened';

  // ── Typewriter ────────────────────────────────────────────
  private typewriterQueues: Record<string, string[]> = {};
  private typewriterActive: Record<string, boolean> = {};
  private readonly TYPEWRITER_DELAY = 12;

  // ── SSE ───────────────────────────────────────────────────
  private eventSource: EventSource | null = null;

  constructor(
    private reportSvc : ReportService,
    private iaService : IaServicesService,
    private chatSvc   : ChatService,
    private toastr    : ToastrService,
    private ngZone    : NgZone,
    private cdr       : ChangeDetectorRef,
    private router    : Router,
    private route     : ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initPipelineSteps();
    this.loadDatasets();

    // Check for query params (from dashboard "Generate Report" button)
    this.route.queryParams.subscribe(params => {
      if (params['datasetId']) {
        this.selectedDatasetId = +params['datasetId'];
        if (params['conversationId']) {
          this.selectedConvId = +params['conversationId'];
        }
        // Auto-start generation
        setTimeout(() => this.generateReport(), 500);
      }
    });
  }

  ngOnDestroy(): void {
    this.closeEventSource();
  }

  // ── Pipeline steps init ───────────────────────────────────
  private initPipelineSteps(): void {
    this.pipelineSteps = [
      { key: 'loading_context', label: 'Chargement du contexte',     icon: '📂', status: 'pending' },
      { key: 'rag_retrieval',   label: 'Recherche vectorielle RAG',  icon: '🔍', status: 'pending' },
      { key: 'web_search',      label: 'Recherche web Serper',       icon: '🌐', status: 'pending' },
      { key: 'merging_context', label: 'Fusion des contextes',       icon: '🔗', status: 'pending' },
      { key: 'generating',      label: 'Génération Gemini',          icon: '✨', status: 'pending' },
      { key: 'finalizing',      label: 'Finalisation du rapport',    icon: '📄', status: 'pending' },
    ];
  }

  // ── Data loading ──────────────────────────────────────────
  private loadDatasets(): void {
    this.iaService.getMyDatasets(1, 100).subscribe({
      next : (res) => { this.datasets = res.datasets; },
      error: () => {}
    });
  }

  onDatasetChange(): void {
    this.selectedConvId = null;
    this.conversations = [];
    if (this.selectedDatasetId) {
      this.chatSvc.listConversations(this.selectedDatasetId).subscribe({
        next: (convs) => { this.conversations = convs; },
        error: () => {}
      });
    }
  }

  // ── Generate Report (SSE streaming) ───────────────────────
  generateReport(): void {
    if (!this.selectedDatasetId) {
      this.toastr.warning('Sélectionnez un dataset.', 'Info', { timeOut: 3000 });
      return;
    }

    // Reset state
    this.resetState();
    this.isGenerating = true;
    this.closeEventSource();

    // Connect SSE
    this.eventSource = this.reportSvc.streamReport(
      this.selectedDatasetId,
      {
        includeWebContext: this.includeWebContext,
        conversationId: this.selectedConvId
      }
    );

    // ── report_start ──
    this.eventSource.addEventListener('report_start', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = JSON.parse(e.data);
        this.reportId    = data.report_id;
        this.datasetName = data.dataset_name;
        this.cdr.detectChanges();
      });
    });

    // ── report_step ──
    this.eventSource.addEventListener('report_step', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = JSON.parse(e.data);
        this.updatePipelineStep(data.step);
        this.cdr.detectChanges();
      });
    });

    // ── report_token ──
    this.eventSource.addEventListener('report_token', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = JSON.parse(e.data);
        const section = data.section as string;
        const delta   = data.delta as string;

        if (!this.typewriterQueues[section]) {
          this.typewriterQueues[section] = [];
          this.typewriterActive[section] = false;
        }

        // Split delta into words for typewriter
        const words = delta.split(/(?<=\s)|(?=\s)/).filter((w: string) => w.length > 0);
        this.typewriterQueues[section].push(...words);
        this.drainTypewriter(section);
      });
    });

    // ── report_section ──
    this.eventSource.addEventListener('report_section', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = JSON.parse(e.data);
        this.handleSection(data.section, data.data);
        this.cdr.detectChanges();
      });
    });

    // ── report_done ──
    this.eventSource.addEventListener('report_done', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = JSON.parse(e.data);
        this.report     = data.report;
        this.latencyMs  = data.latency_ms;
        this.isGenerating = false;
        this.isComplete   = true;

        // Ensure all sections populated from final report
        if (this.report) {
          this.whatHappened   = this.report.what_happened;
          this.whyItHappened = this.report.why_it_happened;
          this.whatToDo      = this.report.what_to_do;
          this.whatToAvoid   = this.report.what_to_avoid;
        }

        // Complete all pipeline steps
        this.pipelineSteps.forEach(s => s.status = 'done');

        this.closeEventSource();
        this.toastr.success(
          `Rapport généré en ${(this.latencyMs / 1000).toFixed(1)}s`,
          'Rapport prêt ',
          { timeOut: 5000, progressBar: true }
        );
        this.cdr.detectChanges();
      });
    });

    // ── report_error ──
    this.eventSource.addEventListener('report_error', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = JSON.parse(e.data);
        this.hasError     = true;
        this.errorMessage = data.error || 'Une erreur est survenue.';
        this.isGenerating = false;
        this.closeEventSource();
        this.toastr.error(this.errorMessage, 'Erreur rapport', { timeOut: 6000, progressBar: true });
        this.cdr.detectChanges();
      });
    });

    // ── Connection error ──
    this.eventSource.onerror = () => {
      this.ngZone.run(() => {
        if (this.isGenerating && !this.isComplete) {
          this.hasError     = true;
          this.errorMessage = 'Connexion au serveur perdue.';
          this.isGenerating = false;
          this.closeEventSource();
          this.cdr.detectChanges();
        }
      });
    };
  }

  // ── Pipeline step updater ─────────────────────────────────
  private updatePipelineStep(step: string): void {
    const idx = this.pipelineSteps.findIndex(s => s.key === step);
    if (idx === -1) return;

    // Mark previous steps as done
    for (let i = 0; i < idx; i++) {
      this.pipelineSteps[i].status = 'done';
    }
    this.pipelineSteps[idx].status = 'active';
  }

  // ── Section handler ───────────────────────────────────────
  private handleSection(section: string, data: any): void {
    switch (section) {
      case 'what_happened':
        this.whatHappened = data;
        break;
      case 'why_it_happened':
        this.whyItHappened = data;
        break;
      case 'what_to_do':
        this.whatToDo = data || [];
        break;
      case 'what_to_avoid':
        this.whatToAvoid = data || [];
        break;
    }
  }

  // ── Typewriter effect ─────────────────────────────────────
  private drainTypewriter(section: string): void {
    if (this.typewriterActive[section]) return;
    this.typewriterActive[section] = true;

    const tick = () => {
      const queue = this.typewriterQueues[section];
      if (!queue || queue.length === 0) {
        this.typewriterActive[section] = false;
        return;
      }
      const word = queue.shift()!;
      this.ngZone.run(() => {
        switch (section) {
          case 'what_happened':
            this.whatHappenedText += word;
            break;
          case 'why_it_happened':
            this.whyItHappenedText += word;
            break;
          case 'what_to_do':
            this.whatToDoText += word;
            break;
          case 'what_to_avoid':
            this.whatToAvoidText += word;
            break;
        }
        this.cdr.detectChanges();
      });
      setTimeout(tick, this.TYPEWRITER_DELAY);
    };
    setTimeout(tick, this.TYPEWRITER_DELAY);
  }

  // ── Helpers ───────────────────────────────────────────────
  private resetState(): void {
    this.report          = null;
    this.reportId        = null;
    this.datasetName     = '';
    this.latencyMs       = 0;
    this.isComplete      = false;
    this.hasError        = false;
    this.errorMessage    = '';
    this.activeSection   = 'what_happened';

    this.whatHappenedText   = '';
    this.whyItHappenedText  = '';
    this.whatToDoText        = '';
    this.whatToAvoidText     = '';

    this.whatHappened   = null;
    this.whyItHappened = null;
    this.whatToDo      = [];
    this.whatToAvoid   = [];

    this.typewriterQueues = {};
    this.typewriterActive = {};
    this.initPipelineSteps();
  }

  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  getConvTitle(conv: Conversation): string {
    return conv.title || `Conv. #${conv.id}`;
  }

  getPriorityLabel(p: number): string {
    const map: Record<number, string> = { 1: 'Critique', 2: 'Important', 3: 'Recommandé' };
    return map[p] || `Priorité ${p}`;
  }

  getPriorityClass(p: number): string {
    const map: Record<number, string> = { 1: 'priority-critical', 2: 'priority-important', 3: 'priority-recommended' };
    return map[p] || 'priority-recommended';
  }

  getSourceIcon(type: string): string {
    return type === 'web' ? '🌐' : '📊';
  }

  get completedSteps(): number {
    return this.pipelineSteps.filter(s => s.status === 'done').length;
  }

  get progressPct(): number {
    return Math.round((this.completedSteps / this.pipelineSteps.length) * 100);
  }

  get allSources(): ReportSource[] {
    return this.whyItHappened?.sources || [];
  }

  get webSources(): ReportSource[] {
    return this.allSources.filter(s => s.type === 'web');
  }

  get internalSources(): ReportSource[] {
    return this.allSources.filter(s => s.type === 'internal');
  }

  goToDashboard(): void {
    if (this.selectedDatasetId) {
      this.router.navigate(['/dashboard'], { queryParams: { datasetId: this.selectedDatasetId } });
    }
  }

  // ── PDF Export ────────────────────────────────────────────
  async exportToPdf(): Promise<void> {
    if (!this.isComplete || this.isExporting) return;

    this.isExporting = true;
    const toastId = this.toastr.info('Préparation du PDF...', 'Export en cours', { timeOut: 0 }).toastId;

    try {
      const element = document.querySelector('.report-layout') as HTMLElement;
      if (!element) throw new Error('Contenu du rapport introuvable.');

      // 1. Add a temporary class to force all sections visible
      element.classList.add('export-mode');

      // Wait a bit for layout to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200 // Ensure consistent width for capture
      });

      // 2. Remove the temporary class
      element.classList.remove('export-mode');

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Handle multi-page PDF if needed
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const filename = `Rapport_IA_${this.datasetName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
      pdf.save(filename);

      this.toastr.remove(toastId);
      this.toastr.success('Le rapport a été téléchargé.', 'Export réussi');
    } catch (err) {
      console.error('PDF Export Error:', err);
      this.toastr.remove(toastId);
      this.toastr.error('Impossible de générer le PDF.', 'Erreur Export');
    } finally {
      this.isExporting = false;
    }
  }
}
