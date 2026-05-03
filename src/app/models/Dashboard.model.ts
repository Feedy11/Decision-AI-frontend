


//KPI schemass
export interface ExecutiveSummaryKpiItem {
  kpi_name        : string;
  target_column   : string;
  pandas_function : string;
  logic_hint      : string;
  description     : string;
  icon            : string;
}

export interface DashboardChartItem {
  rank             : number;
  title            : string;
  relationship     : string;
  strength_score   : number;
  x_axis_column   ?: string | null;
  y_axis_column   ?: string | null;
  pandas_grouping  : string;
  chart_type       : string;
  business_insight : string;
}

//RAG meta
export interface RagMeta {
  retrieved_chunk_ids    : string[];
  retrieval_query_preview: string;
}

//Dashboard record(saved)
export interface DashboardRecord {
  id                    : number;
  dataset_id            : number;
  analysis_id          ?: number | null;
  executive_summary_kpis: ExecutiveSummaryKpiItem[];
  dashboard_charts      : DashboardChartItem[];
  rag_meta             ?: RagMeta | null;
  created_at            : string;
}

//RAG insights response (not saved)
export interface RagInsightsResponse {
  dataset_id            : number;
  executive_summary_kpis: ExecutiveSummaryKpiItem[];
  dashboard_charts      : DashboardChartItem[];
  rag_meta             ?: RagMeta | null;
}

//Execute response
export interface KpiExecutionResult {
  kpi_name         : string;
  target_column   ?: string | null;
  value           ?: number | null;
  formatted_value ?: string | null;
  function_used   ?: string | null;
  error           ?: string | null;
  execution_success: boolean;
}

export interface ChartMetadata {
  chart_index      : number;
  chart_title      : string;
  chart_type      ?: string | null;
  x_axis          ?: string | null;
  y_axis          ?: string | null;
  aggregation     ?: string | null;
  point_count      : number;
  insight          : string;
  data_endpoint    : string;
  execution_success: boolean;
  error           ?: string | null;
}

export interface DashboardExecuteResponse {
  dashboard_id : number;
  dataset_id   : number;
  kpi_results  : KpiExecutionResult[];
  chart_results: ChartMetadata[];
  executed_at  : string;
}

//Chart data
export interface ChartDataResponse {
  chart_index      : number;
  chart_title      : string;
  x_axis          ?: string | null;
  y_axis          ?: string | null;
  aggregation     ?: string | null;
  point_count      : number;
  data             : Record<string, any>;
  execution_success: boolean;
  error           ?: string | null;
}
