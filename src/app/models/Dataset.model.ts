export interface Dataset {
  id               : number;
  filename         : string;
  original_filename: string;
  file_size        : number;
  file_type        : string;
  status           : 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  row_count        : number | null;
  column_count     : number | null;
  created_at       : string;
}

export interface DatasetListResponse {
  datasets : Dataset[];
  total    : number;
  page     : number;
  page_size: number;
}
