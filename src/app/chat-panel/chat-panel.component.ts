import {
  Component, OnInit, OnDestroy,
  ViewChild, ElementRef, Input, NgZone, ChangeDetectorRef
} from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter }        from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import type { Options } from 'highcharts';

import { Dataset } from '../models/Dataset.model';
import { ChartSpec, Conversation, UiMessage } from '../models/chat.model';
import { ChatService } from '../core/services/chat.service';
import { IaServicesService } from '../core/services/ia-services.service';
import { AuthService } from '../core/services/auth.service';
import { HighchartsBaseComponent } from '../shared/highcharts/highcharts-base.component';
import { buildChatChartOptions } from '../shared/highcharts/highcharts-chat.adapter';

const PUBLIC_ROUTES = ['/login', '/pass', '/reset-password'];

@Component({
  selector  : 'app-chat-panel',
  standalone: true,
  imports   : [CommonModule, FormsModule, HighchartsBaseComponent],
  templateUrl: './chat-panel.component.html',
  styleUrls : ['./chat-panel.component.css']
})
export class ChatPanelComponent implements OnInit, OnDestroy {

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('inputRef')          inputRef!: ElementRef;


  @Input() set open(val: boolean) { this.isOpen = val; }

  //État panel
  isOpen        = false;
  isTyping      = false;
  unreadCount   = 0;
  isPublicRoute = false;
  isAdmin       = false;

  //Dataset & conversation
  datasetsLoading  = false;
  datasets         : Dataset[]      = [];
  conversations    : Conversation[] = [];
  activeDatasetId  : number | null  = null;
  activeDatasetName: string | null  = null;
  activeConvId     : number | null  = null;
  showConvList     = false;
  showDatasetPicker = false;

  //Messages UI
  messages : UiMessage[] = [];
  inputText              = '';

  //SSE streaming
  private eventSource    : EventSource | null = null;
  private streamingMsgId : string | null      = null;
  private streamCompleted = false;

  // Typewriter queue
  private typewriterQueue : string[]  = [];
  private typewriterActive = false;
  private readonly TYPEWRITER_DELAY_MS = 18; // ms per word

  //Suggestions
  readonly suggestions = [
    'Analyse mes données de ventes',
    'Quels sont les KPIs principaux ?',
    'Détecte des anomalies dans mes données',
    'Résume ce dataset en quelques points',
  ];

  readonly quickActions = [
    'Explique davantage',
    'Génère un graphique',
    'Plus de détails',
  ];

  constructor(
    private chatSvc  : ChatService,
    private iaService: IaServicesService,
    private auth     : AuthService,
    private router   : Router,
    private toastr   : ToastrService,
    private ngZone   : NgZone,
    private cdr      : ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.resolveIsAdmin();
    this.checkRoute(this.router.url);
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => this.checkRoute(e.urlAfterRedirects));
    this.loadDatasets();
    // Re-load once profile is in localStorage (is_superuser may arrive after token)
    if (!this.auth.getUser()) {
      this.auth.loadUserMe().subscribe({
        next: () => {
          this.isAdmin = this.resolveIsAdmin();
          this.loadDatasets();
        },
        error: () => this.loadDatasets(),
      });
    }
  }

  ngOnDestroy(): void {
    this.closeEventSource();
  }

  private checkRoute(url: string): void {
    this.isPublicRoute = PUBLIC_ROUTES.some(r => url.startsWith(r));
    if (this.isPublicRoute) this.isOpen = false;
  }

  //Toggle panel
  togglePanel(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.unreadCount = 0;
      this.isAdmin = this.resolveIsAdmin();
      this.loadDatasets();
      setTimeout(() => this.inputRef?.nativeElement?.focus(), 200);
    }
  }

  /** Admin if profile says superuser or JWT carries role=admin (IA-service uses JWT role). */
  private resolveIsAdmin(): boolean {
    if (this.auth.isSuperuser()) return true;
    const token = this.auth.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role === 'admin';
    } catch {
      return false;
    }
  }

  //Datasets
  private loadDatasets(): void {
    if (!this.auth.getToken()) {
      this.datasets = [];
      this.datasetsLoading = false;
      return;
    }
    this.datasetsLoading = true;
    const request$ = this.isAdmin
      ? this.iaService.getAllDatasets(1, 100)
      : this.iaService.getMyDatasets(1, 100);

    request$.subscribe({
      next: (res) => {
        this.datasetsLoading = false;
        this.datasets = res.datasets ?? [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.datasetsLoading = false;
        this.datasets = [];
        const detail = err?.error?.detail;
        const msg = typeof detail === 'string'
          ? detail
          : 'Impossible de charger les datasets. Vérifiez que le service IA (port 8001) est démarré et que ng serve utilise le proxy.';
        this.toastr.error(msg, 'Assistant IA', { timeOut: 5000 });
        this.cdr.detectChanges();
      },
    });
  }

  //Changer de dataset
  onDatasetSelect(datasetId: number): void {
    if (this.activeDatasetId === datasetId) {
      this.showDatasetPicker = false;
      return;
    }
    this.activeDatasetId   = datasetId;
    this.activeDatasetName = this.datasets.find(d => d.id === datasetId)?.original_filename ?? null;
    this.activeConvId      = null;
    this.messages          = [];
    this.showDatasetPicker = false;

    // Lancer automatiquement l'indexation en arrière-plan pour faciliter le chat
    this.chatSvc.rebuildIndex(datasetId).subscribe({
      next: () => console.log(`Auto-indexation lancée pour le dataset ${datasetId}`),
      error: (err) => console.warn(`Impossible de lancer l'indexation:`, err)
    });

    this.chatSvc.listConversations(datasetId).subscribe({
      next: (convs) => {
        this.conversations = convs;
        if (convs.length > 0) {
          this.selectConversation(convs[0]);
        } else {
          this.createNewConversation();
        }
      },
      error: () => this.toastr.error('Erreur chargement conversations.', 'Erreur', { timeOut: 3000 })
    });
  }

  //Créer conversation
  createNewConversation(): void {
    if (!this.activeDatasetId) return;
    const title = `Conversation ${new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`;

    this.chatSvc.createConversation(this.activeDatasetId, { title }).subscribe({
      next: (res) => {
        this.activeConvId  = res.conversation_id;
        this.messages      = [];
        this.showConvList  = false;
        this.conversations = [{
          id: res.conversation_id,
          dataset_id: res.dataset_id,
          title: res.title,
          created_at: res.created_at
        }, ...this.conversations];
      },
      error: () => this.toastr.error('Impossible de créer une conversation.', 'Erreur', { timeOut: 3000 })
    });
  }

  //Sélectionner conversation
  selectConversation(conv: Conversation): void {
    this.activeConvId = conv.id;
    this.messages     = [];
    this.showConvList = false;

    this.chatSvc.getMessages(this.activeDatasetId!, conv.id).subscribe({
      next: (msgs) => {
        this.messages = msgs.map(m => {
          const chartSpec = (m.chart_spec as ChartSpec | undefined) ?? null;
          return {
            id        : m.id,
            role      : m.role,
            content   : m.content,
            timestamp : new Date(m.created_at),
            intent    : m.intent,
            latency_ms: m.latency_ms,
            chunk_ids : m.chunk_ids,
            chartSpec,
            chartOptions: chartSpec ? this.safeBuildChartOptions(chartSpec) : null,
          };
        });
        this.scrollToBottom();
      },
      error: () => {
        this.toastr.error('Impossible de charger l\'historique.', 'Assistant IA', { timeOut: 3000 });
      }
    });
  }

  //Envoyer message (SSE streaming)
  sendMessage(): void {
    const text = this.inputText.trim();
    if (!text || this.isTyping) return;

    // Vérifier dataset sélectionné
    if (!this.activeDatasetId || !this.activeConvId) {
      this.toastr.warning('Sélectionnez d\'abord un dataset.', 'Info', { timeOut: 3000 });
      this.showDatasetPicker = true;
      return;
    }

    // Message utilisateur
    const userMsg: UiMessage = {
      id: `tmp-user-${Date.now()}`, role: 'user',
      content: text, timestamp: new Date()
    };
    this.messages.push(userMsg);
    this.inputText = '';
    this.scrollToBottom();

    // Message assistant (streaming) — reset typewriter state
    this.typewriterQueue  = [];
    this.typewriterActive = false;
    const streamId = `tmp-ai-${Date.now()}`;
    this.streamingMsgId = streamId;
    this.streamCompleted = false;
    const aiMsg: UiMessage = {
      id: streamId, role: 'assistant',
      content: '', timestamp: new Date(), isStreaming: true
    };
    this.messages.push(aiMsg);
    this.isTyping = true;
    this.scrollToBottom();

    // Ouvrir SSE
    this.closeEventSource();
    this.eventSource = this.chatSvc.streamMessage(
      this.activeDatasetId, this.activeConvId, text
    );

    // Token par token → typewriter streaming
    this.eventSource.addEventListener('token', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data  = this.parseEventData(e);
        if (!data) return;
        const delta = data.delta ?? '';
        if (!delta) return;
        const msg = this.messages.find(m => m.id === streamId);
        if (msg) {
          msg.content += delta;
          this.scrollToBottom();
          this.cdr.detectChanges();
        }
      });
    });

    // Intent détecté
    this.eventSource.addEventListener('intent', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = this.parseEventData(e);
        if (!data) return;
        const msg  = this.messages.find(m => m.id === streamId);
        if (msg) msg.intent = data.intent;
        this.cdr.detectChanges();
      });
    });

    // Chunks (Contexte)
    this.eventSource.addEventListener('retrieval', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = this.parseEventData(e);
        if (!data) return;
        const msg  = this.messages.find(m => m.id === streamId);
        if (msg) msg.chunk_ids = data.chunk_ids;
        this.cdr.detectChanges();
      });
    });

    // Chart spec généré
    this.eventSource.addEventListener('chart', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = this.parseEventData(e);
        if (!data) return;
        const msg  = this.messages.find(m => m.id === streamId);
        if (msg && data.chart_spec) {
          this.attachChartSpec(msg, data.chart_spec as ChartSpec);
          this.scrollToBottom();
        }
        this.cdr.detectChanges();
      });
    });

    // Message persisté en base (id réel)
    this.eventSource.addEventListener('message_persisted', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = this.parseEventData(e);
        const msg  = this.messages.find(m => m.id === streamId);
        if (msg && data?.message_id) {
          msg.id = data.message_id;
        }
        this.closeEventSource();
        this.cdr.detectChanges();
      });
    });

    // Fin du stream
    this.eventSource.addEventListener('done', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = this.parseEventData(e);
        if (!data) return;
        const msg  = this.messages.find(m => m.id === streamId);
        if (msg) {
          msg.isStreaming = false;
          msg.latency_ms  = data.latency_ms;
          if (data.message_id && data.message_id > 0) {
            msg.id = data.message_id;
          }
          if (data.chart_spec && !msg.chartSpec) {
            this.attachChartSpec(msg, data.chart_spec as ChartSpec);
          }
        }
        this.streamCompleted = true;
        this.isTyping = false; this.streamingMsgId = null;
        this.scrollToBottom();
        this.cdr.detectChanges();
      });
    });

    // Erreur SSE du backend
    this.eventSource.addEventListener('error', (e: Event) => {
      this.ngZone.run(() => {
        if (this.streamCompleted) {
          this.closeEventSource();
          return;
        }
        const data = this.parseEventData(e);
        this.handleStreamError(streamId, data?.error);
      });
    });

    // Erreur connexion EventSource
    this.eventSource.onerror = () => {
      this.ngZone.run(() => {
        if (this.streamCompleted) {
          this.closeEventSource();
          return;
        }
        this.handleStreamError(streamId);
      });
    };
  }

  private parseEventData(event: Event): any | null {
    const raw = (event as MessageEvent).data;
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private getStreamErrorMessage(error?: string): string {
    const raw = (error || '').trim();
    const lower = raw.toLowerCase();

    if (lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('429')) {
      return 'Le quota Gemini est atteint pour le moment. Reessayez dans quelques minutes ou changez de cle/API plan.';
    }
    if (lower.includes('unavailable') || lower.includes('503') || lower.includes('high demand')) {
      return 'Gemini est temporairement indisponible. Reessayez dans un moment.';
    }
    if (lower.includes('gemini_api_key') || lower.includes('api key')) {
      return 'La cle GEMINI_API_KEY manque ou est invalide cote service IA.';
    }
    if (lower.includes('analysis not found') || lower.includes('run post')) {
      return 'Ce dataset doit etre analyse avant de discuter avec lui.';
    }

    return raw || 'Une erreur est survenue. Veuillez reessayer.';
  }

  private handleStreamError(streamId: string, error?: string): void {
    const msg = this.messages.find(m => m.id === streamId);
    if (msg && !msg.content) {
      msg.content = this.getStreamErrorMessage(error);
    }
    if (msg) {
      if (!msg.content) msg.content = '❌ Une erreur est survenue. Veuillez réessayer.';
      msg.isStreaming = false;
    }
    this.typewriterQueue = [];
    this.typewriterActive = false;
    this.isTyping = false;
    this.streamingMsgId = null;
    this.streamCompleted = true;
    this.closeEventSource();
    this.cdr.detectChanges();
  }

  private closeEventSource(): void {
    if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
  }

  // Typewriter: drain the word queue one word at a time
  private drainTypewriterQueue(streamId: string): void {
    if (this.typewriterActive) return; // already running
    this.typewriterActive = true;
    const tick = () => {
      if (this.typewriterQueue.length === 0) {
        this.typewriterActive = false;
        return;
      }
      const word = this.typewriterQueue.shift()!;
      this.ngZone.run(() => {
        const msg = this.messages.find(m => m.id === streamId);
        if (msg) {
          msg.content += word;
          this.scrollToBottom();
          this.cdr.detectChanges();
        }
      });
      setTimeout(tick, this.TYPEWRITER_DELAY_MS);
    };
    setTimeout(tick, this.TYPEWRITER_DELAY_MS);
  }

  //Suggestion
  sendSuggestion(text: string): void {
    if (!this.activeDatasetId || !this.activeConvId) {
      this.toastr.warning('Sélectionnez d\'abord un dataset.', 'Assistant IA', { timeOut: 3000 });
      this.showDatasetPicker = true;
      return;
    }
    this.inputText = text;
    this.sendMessage();
  }

  //Keyboard
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // ── Clear
  clearMessages(): void {
    this.closeEventSource();
    this.isTyping = false;
    this.createNewConversation();
  }

  clearContext(): void {
    this.activeDatasetId = null; this.activeDatasetName = null;
    this.activeConvId    = null; this.messages = []; this.conversations = [];
  }

  // ── Admin : rebuild index
  rebuildIndex(): void {
    if (!this.activeDatasetId) return;
    this.chatSvc.rebuildIndex(this.activeDatasetId).subscribe({
      next : () => this.toastr.success('Index Chroma reconstruit en arrière-plan.', 'Index ✅', { timeOut: 4000 }),
      error: () => this.toastr.error('Erreur lors du rebuild.', 'Erreur', { timeOut: 4000 })
    });
  }

  // ── Scroll
  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  // ── Helper
  formatTime(date: Date): string {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  getIntentLabel(intent?: string | null): string {
    const map: Record<string, string> = {
      retrieve_only: '🔍 Recherche',
      analyze      : '📊 Analyse',
      visualize    : '📈 Visualisation',
      clarify      : '❓ Clarification',
      refuse_unsafe: '🚫 Refus',
    };
    return intent ? (map[intent] ?? intent) : '';
  }

  getConvTitle(conv: Conversation): string {
    return conv.title || `Conv. #${conv.id}`;
  }

  formatConvDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  private attachChartSpec(msg: UiMessage, spec: ChartSpec): void {
    msg.chartSpec = spec;
    msg.chartOptions = this.safeBuildChartOptions(spec);
  }

  private safeBuildChartOptions(spec: ChartSpec): Options | null {
    try {
      return buildChatChartOptions(spec);
    } catch (err) {
      console.warn('Invalid chat chart spec:', err, spec);
      return null;
    }
  }
}
