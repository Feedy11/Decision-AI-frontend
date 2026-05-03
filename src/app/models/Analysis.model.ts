
export interface Relationship {
  columns        : string[];
  type           : 'predictive' | 'correlation' | 'hierarchy';
  strength       : number;       // 0-1
  direction     ?: string | null;
  method         : string;
  insight       ?: string | null;
  chart_suggestion?: string | null;
}

export interface ColumnCategories {
  metrics    : string[];
  dimensions : string[];
  identifiers: string[];
  temporal   : string[];
  geographic : string[];
  other      : string[];
}

export interface KPIPrimary    { name: string; aggregation: string; value: number; }
export interface KPICard       { name: string; value: number | string; }
export interface KPITrendPoint { period: string; value: number; }
export interface KPITrend      { time_column: string; granularity: string; series: KPITrendPoint[]; }
export interface KPIDimensionValue { key: string; value: number; }
export interface KPIDimensionTopN  { dimension: string; top_n: KPIDimensionValue[]; }

export interface KPIResponse {
  primary     : KPIPrimary;
  cards       : KPICard[];
  trend      ?: KPITrend | null;
  by_dimension: KPIDimensionTopN[];
}

export interface AnalysisResult {
  dataset_id         : number;
  relationships      : Relationship[];
  dashboard_columns  : string[];
  column_categories  : ColumnCategories;
  primary_metric    ?: string | null;
  kpi               ?: KPIResponse | null;
  confidence_score   : number;
  total_relationships: number;
  created_at         : string;
}

export interface SimpleRelationshipResponse {
  relationships    : string[][];   // [["ads","sales"], ["region","sales"]]
  dashboard_columns: string[];
}


export interface ColumnCategoriesResponse extends ColumnCategories {
  primary_metric?: string | null;
}

export interface StatisticalRelationshipItem {
  effect_size      : number;
  relationship_type: string;
  description      : string;
}

export interface StatisticalAnalysisBlock {
  label            : string;
  shape            : { rows: number; columns: number };
  alpha           ?: number | null;
  n_tests          : number;
  relationships    : StatisticalRelationshipItem[];
  sections         : Record<string, string[]>;
  total_meaningful : number;
  message         ?: string | null;
}

export interface PerDatasetStatisticalResult extends StatisticalAnalysisBlock {
  dataset_id: number;
}

export interface MergedStatisticalBlock {
  merge_log  : string[];
  dataset_ids: number[];
  analysis  ?: StatisticalAnalysisBlock | null;
  message   ?: string | null;
}

export interface StatisticalAnalyticsResponse {
  per_dataset: PerDatasetStatisticalResult[];
  merged     ?: MergedStatisticalBlock | null;
}
