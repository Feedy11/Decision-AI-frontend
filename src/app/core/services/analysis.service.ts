import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AnalysisResult,
  SimpleRelationshipResponse,
  ColumnCategoriesResponse,
  StatisticalAnalyticsResponse
} from '../../models/Analysis.model';
import { IA_API_BASE } from '../config/api-base';

@Injectable({ providedIn: 'root' })
export class AnalysisService {

  private readonly API = IA_API_BASE;

  constructor(private http: HttpClient) {}

  analyzeDataset(datasetId: number, forceReanalyze = false): Observable<AnalysisResult> {
    return this.http.post<AnalysisResult>(
      `${this.API}/datasets/${datasetId}/analyze`,
      { force_reanalyze: forceReanalyze }
    );
  }

  getAnalysis(datasetId: number): Observable<AnalysisResult> {
    return this.http.get<AnalysisResult>(`${this.API}/datasets/${datasetId}/analysis`);
  }

  deleteAnalysis(datasetId: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/datasets/${datasetId}/analysis`);
  }

  getRelationships(datasetId: number): Observable<SimpleRelationshipResponse> {
    return this.http.get<SimpleRelationshipResponse>(
      `${this.API}/datasets/${datasetId}/relationships`
    );
  }

  getColumnCategories(datasetId: number): Observable<ColumnCategoriesResponse> {
    return this.http.get<ColumnCategoriesResponse>(
      `${this.API}/datasets/${datasetId}/column-categories`
    );
  }

  getStatisticalRelationships(datasetIds: number[]): Observable<StatisticalAnalyticsResponse> {
    return this.http.post<StatisticalAnalyticsResponse>(
      `${this.API}/analysis/statistical-relationships`,
      { dataset_ids: datasetIds }
    );
  }
}
