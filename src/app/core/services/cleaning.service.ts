import { Injectable }  from '@angular/core';
import { HttpClient }  from '@angular/common/http';
import { Observable }  from 'rxjs';
import {
  CleaningProfile,
  CleaningProfileCreate,
  CleaningReport,
  DataQuality,
  ValidationResult
} from '../../models/Cleaning.model';

@Injectable({ providedIn: 'root' })
export class CleaningService {

  private readonly API = 'http://localhost:8001/api/v1';

  constructor(private http: HttpClient) {}

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
  cleanDataset(datasetId: number, profileId?: number, saveAsNew = false): Observable<CleaningReport> {
    let url = `${this.API}/datasets/${datasetId}/clean?save_as_new=${saveAsNew}`;
    if (profileId) url += `&profile_id=${profileId}`;
    return this.http.post<CleaningReport>(url, {});
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
}
