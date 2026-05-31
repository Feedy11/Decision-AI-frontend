//Enums
export type MissingValueStrategy = 'drop' | 'fill' | 'interpolate';
export type FillStrategy         = 'mean' | 'median' | 'mode' | 'constant';
export type OutlierMethod        = 'auto' | 'iqr' | 'mad' | 'log_iqr' | 'zscore' | 'isolation_forest' | 'lof';
export type OutlierAction        = 'flag' | 'remove' | 'cap';

//CleaningProfile
export interface CleaningProfileCreate {
  name                  : string;
  description          ?: string;
  handle_missing        : MissingValueStrategy;
  missing_fill_strategy : FillStrategy;
  missing_fill_value   ?: string | null;
  remove_duplicates     : boolean;
  duplicate_subset     ?: string[] | null;
  fix_data_types        : boolean;
  detect_outliers       : boolean;
  outlier_method        : OutlierMethod;
  outlier_threshold     : number;
  outlier_action        : OutlierAction;
  strip_whitespace      : boolean;
  standardize_text      : boolean;
  standardize_dates     : boolean;
  date_format          ?: string | null;
  normalize_numeric     : boolean;
  normalization_method ?: string | null;
}

export interface CleaningProfile extends CleaningProfileCreate {
  id         : number;
  is_default : boolean;
  created_at : string;
  updated_at : string | null;
}

//CleaningReport
export interface CleaningReport {
  dataset_id              : number;
  profile_id              : number | null;
  rows_before             : number;
  rows_after              : number;
  duplicates_removed      : number;
  missing_values_handled  : number;
  outliers_detected       : number;
  data_types_fixed        : number;
  operations_performed    : string[];
  cleaning_report         : Record<string, any>;
  created_at              : string;
}

//DataQuality
export interface DataQuality {
  dataset_id          : number;
  quality_score       : number;
  total_rows          : number;
  total_columns       : number;
  missing_values      : { total: number; by_column: Record<string, number>; percentage: number };
  duplicates          : { count: number; percentage: number };
  data_types          : Record<string, string>;
  numeric_summary     : Record<string, { mean: number | null; median: number | null; std: number | null; min: number | null; max: number | null; missing: number }>;
  categorical_summary : Record<string, { unique_values: number; most_common: string | null; missing: number }>;
  validation_errors   : string[];
  validation_warnings : string[];
}

//Validation
export interface ValidationResult {
  dataset_id      : number;
  valid           : boolean;
  errors          : string[];
  warnings        : string[];
  checks_performed: string[];
  total_checks    : number;
}

//Default profile values
export const DEFAULT_PROFILE: CleaningProfileCreate = {
  name                  : '',
  description           : '',
  handle_missing        : 'fill',
  missing_fill_strategy : 'median',
  missing_fill_value    : null,
  remove_duplicates     : true,
  duplicate_subset      : null,
  fix_data_types        : true,
  detect_outliers       : true,
  outlier_method        : 'auto',
  outlier_threshold     : 1.5,
  outlier_action        : 'cap',
  strip_whitespace      : true,
  standardize_text      : true,
  standardize_dates     : true,
  date_format           : null,
  normalize_numeric     : false,
  normalization_method  : null
};

// ── Scan (BEFORE cleaning) ──────────────────────────────────────────────────
export type IssueType = 'missing' | 'missing_token' | 'outlier' | 'duplicate';
export type IssueSeverity = 'error' | 'warning';

export interface ScanIssue {
  row_index    : number;
  row_number   : number;
  column       : string | null;
  issue_type   : IssueType;
  description  : string;
  current_value: any;
  severity     : IssueSeverity;
}

export interface ScanResult {
  dataset_id  : number;
  cached      : boolean;
  total_issues: number;
  summary     : Partial<Record<IssueType, number>>;
  issues      : ScanIssue[];
}

// ── Repair diff (AFTER cleaning) ────────────────────────────────────────────
export type ChangeType =
  | 'filled_missing'
  | 'text_stripped'
  | 'text_normalized'
  | 'value_capped'
  | 'set_to_missing'
  | 'row_removed'
  | 'row_removed_duplicate'
  | 'modified';

export interface ChangeRecord {
  row_index  : number;
  row_number : number;
  column     : string | null;
  change_type: ChangeType | string;
  before     : any;
  after      : any;
  description: string;
}
