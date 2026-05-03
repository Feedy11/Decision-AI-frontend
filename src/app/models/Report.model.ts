/**
 * Report models — mirrors backend report_schema.py
 */

// ── SSE event types ─────────────────────────────────────────────
export type ReportSseEventType =
  | 'report_start'
  | 'report_step'
  | 'report_token'
  | 'report_section'
  | 'report_done'
  | 'report_error';

export type ReportStep =
  | 'loading_context'
  | 'rag_retrieval'
  | 'web_search'
  | 'merging_context'
  | 'generating'
  | 'finalizing';

// ── Report section models ───────────────────────────────────────
export interface WhatHappened {
  narrative: string;
}

export interface ReportSource {
  type: 'internal' | 'web';
  title: string;
  url?: string | null;
}

export interface WhyItHappened {
  narrative: string;
  sources: ReportSource[];
}

export interface ActionableRecommendation {
  priority: number;
  action: string;
  expected_outcome: string;
}

// ── Full report document ────────────────────────────────────────
export interface ReportDocument {
  report_id: string;
  generated_at: string;
  dataset_name: string;
  filters_applied: Record<string, any>;
  what_happened: WhatHappened;
  why_it_happened: WhyItHappened;
  what_to_do: ActionableRecommendation[];
  what_to_avoid: string[];
}

// ── SSE event payloads ──────────────────────────────────────────
export interface ReportStartEvent {
  report_id: string;
  dataset_name: string;
}

export interface ReportStepEvent {
  step: ReportStep;
  message: string;
}

export interface ReportTokenEvent {
  section: string;
  delta: string;
}

export interface ReportSectionEvent {
  section: string;
  data: any;
}

export interface ReportDoneEvent {
  report: ReportDocument;
  latency_ms: number;
}

export interface ReportErrorEvent {
  error: string;
}

// ── Pipeline step UI metadata ───────────────────────────────────
export interface PipelineStepUI {
  key: ReportStep;
  label: string;
  icon: string;
  status: 'pending' | 'active' | 'done' | 'error';
}
