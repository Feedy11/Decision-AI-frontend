import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChartDataResponse, DashboardExecuteResponse, DashboardRecord, RagInsightsResponse } from '../../models/Dashboard.model';
import { IA_API_BASE } from '../config/api-base';

@Injectable({ providedIn: 'root' })
export class DashboardService {

  private readonly API = IA_API_BASE;

  constructor(private http: HttpClient) {}

  // POST /api/v1/datasets/{id}/rag-insights?save=false
  generateInsights(datasetId: number, debug = false): Observable<RagInsightsResponse> {
    return this.http.post<RagInsightsResponse>(
      `${this.API}/datasets/${datasetId}/rag-insights?save=false&debug=${debug}`, {}
    );
  }

  // POST /api/v1/datasets/{id}/rag-insights?save=true
  generateAndSave(datasetId: number): Observable<DashboardRecord> {
    return this.http.post<DashboardRecord>(
      `${this.API}/datasets/${datasetId}/rag-insights?save=true`, {}
    );
  }

  // GET /api/v1/datasets/{id}/dashboards
  getDashboards(datasetId: number, skip = 0, limit = 20): Observable<DashboardRecord[]> {
    return this.http.get<DashboardRecord[]>(
      `${this.API}/datasets/${datasetId}/dashboards?skip=${skip}&limit=${limit}`
    );
  }

  // POST /api/v1/dashboards/{id}/execute
  executeDashboard(dashboardId: number): Observable<DashboardExecuteResponse> {
    return this.http.post<DashboardExecuteResponse>(
      `${this.API}/dashboards/${dashboardId}/execute`, {}
    );
  }

  // GET /api/v1/dashboards/{id}/charts/{index}/data
  getChartData(dashboardId: number, chartIndex: number): Observable<ChartDataResponse> {
    return this.http.get<ChartDataResponse>(
      `${this.API}/dashboards/${dashboardId}/charts/${chartIndex}/data`
    );
  }
}
