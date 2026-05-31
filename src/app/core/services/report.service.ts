import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ReportDocument } from '../../models/Report.model';
import { IA_API_BASE } from '../config/api-base';

@Injectable({ providedIn: 'root' })
export class ReportService {

  private readonly API = IA_API_BASE;

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  /**
   * SSE streaming report generation.
   * Returns an EventSource that emits report_start, report_step,
   * report_token, report_section, report_done, report_error events.
   */
  streamReport(
    datasetId: number,
    options: {
      includeWebContext?: boolean;
      filters?: Record<string, any>;
      conversationId?: number | null;
      language?: string;
    } = {}
  ): EventSource {
    const params = new URLSearchParams();

    if (options.includeWebContext !== undefined) {
      params.set('include_web_context', String(options.includeWebContext));
    }
    if (options.filters) {
      params.set('filters', JSON.stringify(options.filters));
    }
    if (options.conversationId) {
      params.set('conversation_id', String(options.conversationId));
    }
    params.set('language', options.language || 'fr');

    const token = this.auth.getToken();
    if (token) {
      params.set('access_token', token);
    }

    const url = `${this.API}/datasets/${datasetId}/reports/stream?${params.toString()}`;
    return new EventSource(url);
  }

  /**
   * Non-streaming report generation (for testing / fallback).
   */
  generateReport(
    datasetId: number,
    body: {
      filters?: Record<string, any>;
      include_web_context?: boolean;
      conversation_id?: number | null;
      language?: string;
    } = {}
  ): Observable<ReportDocument> {
    return this.http.post<ReportDocument>(
      `${this.API}/datasets/${datasetId}/reports`, body
    );
  }

  /**
   * SSE streaming for contextual follow-up Q&A on a generated report.
   * Reuses chat SSE events: token, chart, done, error, message_persisted.
   */
  streamReportFollowUp(
    datasetId: number,
    reportId: string,
    conversationId: number,
    message: string,
    activeSection?: string
  ): EventSource {
    const params = new URLSearchParams();
    params.set('conversation_id', String(conversationId));
    params.set('message', message);
    if (activeSection) {
      params.set('active_section', activeSection);
    }

    const token = this.auth.getToken();
    if (token) {
      params.set('access_token', token);
    }

    const url = `${this.API}/datasets/${datasetId}/reports/${reportId}/followup/stream?${params.toString()}`;
    return new EventSource(url);
  }
}
