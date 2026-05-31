import {
  Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, ViewChild
} from '@angular/core';
import { CommonModule }     from '@angular/common';
import { FormsModule }      from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService }    from 'ngx-toastr';
import jsPDF from 'jspdf';

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
import { ReportQaPanelComponent } from './report-qa-panel/report-qa-panel.component';

type InteractiveReportSection = 'what_happened' | 'why' | 'what_to_do' | 'sources';

interface InteractiveSegment {
  text: string;
  interactive: boolean;
  section: InteractiveReportSection;
  context?: string;
}

interface SelectedReportSentence {
  text: string;
  section: InteractiveReportSection;
  context?: string;
}

@Component({
  selector   : 'app-report',
  standalone : true,
  imports    : [CommonModule, FormsModule, ReportQaPanelComponent],
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

  // ── Report Q&A panel ──────────────────────────────────────
  qaPanelOpen       = false;
  qaConversationId  : number | null = null;
  suggestionChips   : string[] = [];

  @ViewChild(ReportQaPanelComponent) qaPanel?: ReportQaPanelComponent;

  selectedSentence: SelectedReportSentence | null = null;
  sentenceInstruction = '';
  sentenceNote = '';
  sentenceNotes: Array<SelectedReportSentence & { note: string; createdAt: Date }> = [];

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
        conversationId: this.selectedConvId,
        language: 'fr'
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

        this.suggestionChips = this.buildSuggestionChips();

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
    this.qaPanelOpen     = false;
    this.qaConversationId = null;
    this.suggestionChips = [];
    this.selectedSentence = null;
    this.sentenceInstruction = '';
    this.sentenceNote = '';
    this.sentenceNotes = [];

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

  openQaPanel(prefill?: string): void {
    if (!this.qaConversationId) {
      this.ensureQaConversation(() => this.openQaPanel(prefill));
      return;
    }
    this.qaPanelOpen = true;
    this.cdr.detectChanges();
    if (prefill) {
      setTimeout(() => this.qaPanel?.ask(prefill), 100);
    }
  }

  askAboutRecommendation(rec: ActionableRecommendation, index: number): void {
    const title = rec.action.length > 80 ? `${rec.action.slice(0, 80)}…` : rec.action;
    this.openQaPanel(`Explique en détail la recommandation #${index + 1} : ${title}`);
  }

  getInteractiveSegments(
    text: string | null | undefined,
    section: InteractiveReportSection,
    context?: string
  ): InteractiveSegment[] {
    if (!text) return [];

    const parts = text.match(/[^.!?;:]+[.!?;:]?|\s+/g) || [text];
    return parts
      .map(part => {
        const interactive = /\S/.test(part) && /[A-Za-zÀ-ÿ0-9]/.test(part);
        return { text: part, interactive, section, context };
      })
      .filter(part => part.text.length > 0);
  }

  openSentenceModal(segment: InteractiveSegment): void {
    if (!segment.interactive || this.isGenerating) return;

    this.selectedSentence = {
      text: segment.text.trim(),
      section: segment.section,
      context: segment.context
    };
    this.sentenceInstruction = '';
    this.sentenceNote = '';
  }

  closeSentenceModal(): void {
    this.selectedSentence = null;
    this.sentenceInstruction = '';
    this.sentenceNote = '';
  }

  askAboutSelectedSentence(action: 'explain' | 'chart' | 'challenge' | 'question' | 'custom'): void {
    if (!this.selectedSentence) return;

    const instruction = this.buildSentenceInstruction(action);
    this.closeSentenceModal();
    this.openQaPanel(instruction);
  }

  approveSelectedSentence(): void {
    if (!this.selectedSentence) return;
    this.toastr.success('Phrase approuvée.', 'Rapport', { timeOut: 2500 });
    this.closeSentenceModal();
  }

  addSentenceNote(): void {
    if (!this.selectedSentence || !this.sentenceNote.trim()) return;

    this.sentenceNotes.push({
      ...this.selectedSentence,
      note: this.sentenceNote.trim(),
      createdAt: new Date()
    });
    this.toastr.success('Note ajoutée à cette phrase.', 'Rapport', { timeOut: 2500 });
    this.sentenceNote = '';
  }

  get sectionModalLabel(): string {
    if (!this.selectedSentence) return '';
    const labels: Record<InteractiveReportSection, string> = {
      what_happened: "Ce qui s'est passé",
      why: 'Pourquoi',
      what_to_do: 'Quoi faire',
      sources: 'Sources'
    };
    return labels[this.selectedSentence.section];
  }

  private buildSentenceInstruction(action: 'explain' | 'chart' | 'challenge' | 'question' | 'custom'): string {
    const sentence = this.selectedSentence?.text || '';
    const context = this.selectedSentence?.context ? `\nContexte local : ${this.selectedSentence.context}` : '';
    const base = `Dans le rapport, analyse uniquement cette phrase : "${sentence}"${context}`;

    switch (action) {
      case 'chart':
        return `${base}\nMontre-moi le graphique ou les chiffres derrière cette affirmation si les données le permettent.`;
      case 'challenge':
        return `${base}\nChallenge cette affirmation : quelles hypothèses, limites ou contre-exemples faut-il vérifier ?`;
      case 'question':
        return `${base}\nExplique pourquoi cela se produit et relie la réponse au dataset original.`;
      case 'custom':
        return `${base}\nInstruction utilisateur : ${this.sentenceInstruction.trim() || 'Explique cette phrase en détail.'}`;
      case 'explain':
      default:
        return `${base}\nExplique cette phrase en français, simplement, avec les preuves disponibles dans le rapport et le dataset.`;
    }
  }

  private ensureQaConversation(onReady?: () => void): void {
    if (!this.selectedDatasetId) return;

    if (this.selectedConvId) {
      this.qaConversationId = this.selectedConvId;
      onReady?.();
      return;
    }

    if (this.qaConversationId) {
      onReady?.();
      return;
    }

    const shortId = this.reportId ? this.reportId.slice(0, 8) : 'rapport';
    this.chatSvc.createConversation(this.selectedDatasetId, {
      title: `Q&A Rapport ${shortId}`
    }).subscribe({
      next: (res) => {
        this.qaConversationId = res.conversation_id;
        onReady?.();
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.warning('Impossible de créer la session Q&A.', 'Rapport', { timeOut: 4000 });
      }
    });
  }

  private buildSuggestionChips(): string[] {
    const chips: string[] = [];

    const narrative = this.whatHappened?.narrative || this.whatHappenedText || '';
    if (narrative) {
      chips.push('Détaillez les points clés du résumé');
    }

    if (this.whatToDo.length >= 2) {
      chips.push('Expliquez la recommandation #2');
    } else if (this.whatToDo.length >= 1) {
      chips.push('Expliquez la recommandation #1');
    }

    if (this.webSources.length > 0 && this.internalSources.length > 0) {
      chips.push('Comparez les sources web et les données internes');
    } else if (this.allSources.length > 0) {
      chips.push('Quelles sources ont été utilisées ?');
    }

    if (this.whyItHappened?.narrative || this.whyItHappenedText) {
      chips.push('Pourquoi ces causes ont-elles été identifiées ?');
    }

    return chips.slice(0, 5);
  }

  // ── PDF Export — Simple clean document ─────────────────────
  async exportToPdf(): Promise<void> {
    if (!this.isComplete || this.isExporting) return;

    this.isExporting = true;
    const toastId = this.toastr.info('Préparation du PDF...', 'Export en cours', { timeOut: 0 }).toastId;

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();
      const ML = 20;
      const MR = 20;
      const CW = W - ML - MR;
      const now = new Date();
      let pageNum = 0;

      // ── Helpers ─────────────────────────────────────
      const addFooter = () => {
        pageNum++;
        pdf.setTextColor(160, 160, 160);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${pageNum}`, W / 2, H - 12, { align: 'center' });
      };

      const checkPage = (y: number, need: number): number => {
        if (y + need > H - 20) {
          addFooter();
          pdf.addPage();
          return 25;
        }
        return y;
      };

      const wrap = (t: string): string[] => pdf.splitTextToSize(t, CW);

      // ── Document ────────────────────────────────────
      let y = 30;

      // Title — size 20, bold
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RAPPORT D\'ANALYSE IA', ML, y);
      y += 10;

      // Dataset & date
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`Dataset : ${this.datasetName || '—'}    |    ${now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, ML, y);
      y += 4;
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.4);
      pdf.line(ML, y, W - MR, y);
      y += 14;

      // ── 1. Ce qui s'est passé ───────────────────────
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Ce qui s\'est passé', ML, y);
      y += 9;

      const whText = this.whatHappened?.narrative || this.whatHappenedText || '';
      if (whText) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        const lines = wrap(whText);
        for (const line of lines) {
          y = checkPage(y, 6);
          pdf.text(line, ML, y);
          y += 5.5;
        }
      }
      y += 10;

      // ── 2. Pourquoi ─────────────────────────────────
      y = checkPage(y, 25);
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Pourquoi', ML, y);
      y += 9;

      const whyText = this.whyItHappened?.narrative || this.whyItHappenedText || '';
      if (whyText) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        const lines = wrap(whyText);
        for (const line of lines) {
          y = checkPage(y, 6);
          pdf.text(line, ML, y);
          y += 5.5;
        }
      }
      y += 10;

      // ── 3. Recommandations ──────────────────────────
      y = checkPage(y, 25);
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Recommandations', ML, y);
      y += 9;

      if (this.whatToDo && this.whatToDo.length > 0) {
        this.whatToDo.forEach((rec, idx) => {
          y = checkPage(y, 16);
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          const aLines = wrap(`${idx + 1}. ${rec.action}`);
          aLines.forEach((line: string) => { pdf.text(line, ML, y); y += 5.5; });

          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(60, 60, 60);
          const oLines = wrap(`Résultat attendu : ${rec.expected_outcome}`);
          oLines.forEach((line: string) => { y = checkPage(y, 6); pdf.text(line, ML + 5, y); y += 5.5; });
          y += 4;
        });
      }
      y += 6;

      // ── 4. À éviter ─────────────────────────────────
      if (this.whatToAvoid && this.whatToAvoid.length > 0) {
        y = checkPage(y, 25);
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('À éviter', ML, y);
        y += 9;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        this.whatToAvoid.forEach((item) => {
          y = checkPage(y, 8);
          const lines = wrap(`- ${item}`);
          lines.forEach((line: string) => { pdf.text(line, ML, y); y += 5.5; });
          y += 2;
        });
        y += 6;
      }

      // ── 5. Sources ──────────────────────────────────
      if (this.allSources.length > 0) {
        y = checkPage(y, 25);
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Sources', ML, y);
        y += 9;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        this.allSources.forEach((src) => {
          y = checkPage(y, 10);
          pdf.text(`- ${src.title}`, ML, y);
          y += 5.5;
          if (src.url) {
            pdf.setTextColor(100, 100, 100);
            pdf.setFontSize(9);
            pdf.text(src.url, ML + 5, y);
            pdf.setFontSize(11);
            pdf.setTextColor(0, 0, 0);
            y += 5;
          }
        });
      }

      // Footer on last page
      addFooter();

      // Save
      const safeName = (this.datasetName || 'rapport').replace(/[^a-zA-Z0-9À-ÿ\s_-]/g, '').replace(/\s+/g, '_');
      pdf.save(`Rapport_IA_${safeName}_${now.toISOString().slice(0, 10)}.pdf`);

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
