import { Dataset } from "./Dataset.model";

export interface RecentUpload {
  id    : number;
  name  : string;
  date  : string;
  size  : string;
  type  : 'csv' | 'xlsx';
  status: Dataset['status'];
}
