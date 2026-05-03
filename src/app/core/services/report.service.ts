import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { ReportDocument } from '../../models/Report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {

  private readonly API = 'http://localhost:8001/api/v1';

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
    } = {}
  ): Observable<ReportDocument> {
    return this.http.post<ReportDocument>(
      `${this.API}/datasets/${datasetId}/reports`, body
    );
  }
}
