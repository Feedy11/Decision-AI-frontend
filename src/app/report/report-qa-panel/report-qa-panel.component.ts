import {
  Component, Input, NgZone, ChangeDetectorRef, OnDestroy, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ReportService } from '../../core/services/report.service';
import { ChartSpec, UiMessage } from '../../models/chat.model';
import { HighchartsBaseComponent } from '../../shared/highcharts/highcharts-base.component';
import { buildChatChartOptions } from '../../shared/highcharts/highcharts-chat.adapter';
import type { Options } from 'highcharts';

@Component({
  selector: 'app-report-qa-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, HighchartsBaseComponent],
  templateUrl: './report-qa-panel.component.html',
  styleUrl: './report-qa-panel.component.css'
})
export class ReportQaPanelComponent implements OnDestroy {

  @Input({ required: true }) datasetId!: number;
  @Input({ required: true }) reportId!: string;
  @Input({ required: true }) conversationId!: number;
  @Input() datasetName = '';
  @Input() activeSection: 'what_happened' | 'why' | 'what_to_do' | 'sources' = 'what_happened';
  @Input() chips: string[] = [];

  @ViewChild('messagesEnd') messagesEnd?: ElementRef<HTMLDivElement>;

  messages: UiMessage[] = [];
  inputText = '';
  isTyping = false;

  private eventSource: EventSource | null = null;
  private streamingMsgId: string | null = null;
  private streamCompleted = false;

  constructor(
    private reportSvc: ReportService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.closeEventSource();
  }

  get sectionLabel(): string {
    const map: Record<string, string> = {
      what_happened: "Ce qui s'est passé",
      why: 'Pourquoi',
      what_to_do: 'Quoi faire',
      sources: 'Sources'
    };
    return map[this.activeSection] || this.activeSection;
  }

  get shortReportId(): string {
    return this.reportId ? `${this.reportId.slice(0, 8)}…` : '—';
  }

  ask(question: string): void {
    const text = question.trim();
    if (!text || this.isTyping) return;

    this.inputText = '';
    this.sendMessage(text);
  }

  onSubmit(): void {
    this.ask(this.inputText);
  }

  onChipClick(chip: string): void {
    this.ask(chip);
  }

  private sendMessage(text: string): void {
    const userMsg: UiMessage = {
      id: `tmp-user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    this.messages.push(userMsg);

    const streamId = `tmp-ai-${Date.now()}`;
    this.streamingMsgId = streamId;
    this.streamCompleted = false;
    const aiMsg: UiMessage = {
      id: streamId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };
    this.messages.push(aiMsg);
    this.isTyping = true;
    this.scrollToBottom();

    this.closeEventSource();
    this.eventSource = this.reportSvc.streamReportFollowUp(
      this.datasetId,
      this.reportId,
      this.conversationId,
      text,
      this.activeSection
    );

    this.bindSseHandlers(streamId);
  }

  private bindSseHandlers(streamId: string): void {
    if (!this.eventSource) return;

    this.eventSource.addEventListener('token', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = this.parseEventData(e);
        const delta = (data?.['delta'] as string) ?? '';
        if (!delta) return;
        const msg = this.messages.find(m => m.id === streamId);
        if (msg) {
          msg.content += delta;
          this.scrollToBottom();
          this.cdr.detectChanges();
        }
      });
    });

    this.eventSource.addEventListener('chart', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = this.parseEventData(e);
        const msg = this.messages.find(m => m.id === streamId);
        if (msg && data?.['chart_spec']) {
            this.attachChartSpec(msg, data['chart_spec'] as ChartSpec);
          this.scrollToBottom();
          this.cdr.detectChanges();
        }
      });
    });

    this.eventSource.addEventListener('message_persisted', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = this.parseEventData(e);
        const msg = this.messages.find(m => m.id === streamId);
        if (msg && data?.['message_id']) {
          msg.id = data['message_id'] as number;
        }
        if (msg) msg.isStreaming = false;
        this.isTyping = false;
        this.streamingMsgId = null;
        this.streamCompleted = true;
        this.closeEventSource();
        this.cdr.detectChanges();
      });
    });

    this.eventSource.addEventListener('done', (e: MessageEvent) => {
      this.ngZone.run(() => {
        const data = this.parseEventData(e);
        const msg = this.messages.find(m => m.id === streamId);
        if (msg) {
          msg.isStreaming = false;
          if (data?.['chart_spec'] && !msg.chartSpec) {
            this.attachChartSpec(msg, data['chart_spec'] as ChartSpec);
          }
        }
        this.isTyping = false;
        this.streamingMsgId = null;
        this.streamCompleted = true;
        this.scrollToBottom();
        this.cdr.detectChanges();
      });
    });

    this.eventSource.addEventListener('error', () => {
      this.ngZone.run(() => {
        if (this.streamCompleted) {
          this.closeEventSource();
          return;
        }
        const msg = this.messages.find(m => m.id === streamId);
        if (msg && !msg.content) {
          msg.content = 'Une erreur est survenue. Réessayez.';
        }
        if (msg) msg.isStreaming = false;
        this.isTyping = false;
        this.streamingMsgId = null;
        this.closeEventSource();
        this.cdr.detectChanges();
      });
    });
  }

  private parseEventData(e: MessageEvent): Record<string, unknown> | null {
    try {
      return JSON.parse(e.data);
    } catch {
      return null;
    }
  }

  private attachChartSpec(msg: UiMessage, spec: ChartSpec): void {
    msg.chartSpec = spec;
    try {
      msg.chartOptions = buildChatChartOptions(spec);
    } catch {
      msg.chartOptions = null;
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
}
