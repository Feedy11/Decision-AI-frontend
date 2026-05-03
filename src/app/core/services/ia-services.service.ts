import { Injectable }                              from '@angular/core';
import { HttpClient, HttpRequest, HttpHeaders }    from '@angular/common/http';
import { Observable }                              from 'rxjs';
import { Dataset, DatasetListResponse }            from '../../models/Dataset.model';

@Injectable({ providedIn: 'root' })
export class IaServicesService {

  private readonly API = 'http://localhost:8001/api/v1';

  constructor(private http: HttpClient) {}
  getMyDatasets(page = 1, pageSize = 100): Observable<DatasetListResponse> {
    return this.http.get<DatasetListResponse>(
      `${this.API}/datasets/my-datasets?page=${page}&page_size=${pageSize}`
    );
  }
  getAllDatasets(page = 1, pageSize = 100): Observable<DatasetListResponse> {
    return this.http.get<DatasetListResponse>(
      `${this.API}/datasets?page=${page}&page_size=${pageSize}`
    );
  }
  getDatasetById(id: number): Observable<Dataset> {
    return this.http.get<Dataset>(`${this.API}/datasets/${id}`);
  }

  deleteDataset(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/datasets/${id}`);
  }
  uploadFile(file: File, token: string): HttpRequest<FormData> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return new HttpRequest('POST', `${this.API}/upload`, formData, {
      reportProgress: true,
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` })
    });
  }
}
