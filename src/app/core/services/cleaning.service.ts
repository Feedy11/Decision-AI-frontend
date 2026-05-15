import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CleaningProfile,
  CleaningProfileCreate,
  CleaningReport,
  DataQuality,
  ValidationResult,
  ScanResult,
} from '../../models/Cleaning.model';
import { IA_API_BASE } from '../config/api-base';

@Injectable({ providedIn: 'root' })
export class CleaningService {

  private readonly API = IA_API_BASE;

  constructor(private http: HttpClient) { }

  //Profils

  //cleaning-profiles
  getProfiles(): Observable<CleaningProfile[]> {
    return this.http.get<CleaningProfile[]>(`${this.API}/cleaning-profiles`);
  }
  getProfileById(id: number): Observable<CleaningProfile> {
    return this.http.get<CleaningProfile>(`${this.API}/cleaning-profiles/${id}`);
  }
  createProfile(data: CleaningProfileCreate): Observable<CleaningProfile> {
    return this.http.post<CleaningProfile>(`${this.API}/cleaning-profiles`, data);
  }
  deleteProfile(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/cleaning-profiles/${id}`);
  }

  //Nettoyage

  //datasets clean
  cleanDataset(datasetId: number, profileId?: number, saveAsNew = false, missingIdentifierAction = 'drop'): Observable<CleaningReport> {
    const body = {
      dataset_id: datasetId,
      profile_id: profileId,
      save_as_new: saveAsNew,
      missing_identifier_action: missingIdentifierAction
    };
    return this.http.post<CleaningReport>(`${this.API}/datasets/${datasetId}/clean`, body);
  }
  getQuality(datasetId: number): Observable<DataQuality> {
    return this.http.get<DataQuality>(`${this.API}/datasets/${datasetId}/quality`);
  }

  //cleaning-history
  getCleaningHistory(datasetId: number): Observable<CleaningReport[]> {
    return this.http.get<CleaningReport[]>(`${this.API}/datasets/${datasetId}/cleaning-history`);
  }

  //datasets validate
  validateDataset(datasetId: number): Observable<ValidationResult> {
    return this.http.post<ValidationResult>(`${this.API}/datasets/${datasetId}/validate`, {});
  }

  // Scan — pre-computed error sheet cached at upload time
  // force=true  → bypass cache, always run a fresh scan
  // method      -> "auto" (default) | "iqr" | "mad" | "log_iqr" | "zscore" | "lof"
  // threshold   -> conservative outlier threshold (default 3.0)
  scan(
    datasetId: number,
    force = true,
    method = 'auto',
    threshold = 3.0,
  ): Observable<ScanResult> {
    const params = new HttpParams()
      .set('force', String(force))
      .set('method', method)
      .set('threshold', String(threshold));
    return this.http.get<ScanResult>(`${this.API}/datasets/${datasetId}/scan`, { params });
  }

  // Preview raw data
  getPreview(datasetId: number, limit = 100): Observable<any> {
    return this.http.get<any>(`${this.API}/datasets/${datasetId}/preview?limit=${limit}`);
  }
}
