import { Component, OnInit }     from '@angular/core';
import { CommonModule }           from '@angular/common';
import { RouterModule }           from '@angular/router';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { ToastrService }          from 'ngx-toastr';
import { AuthService }            from '../core/services/auth.service';
import { IaServicesService }      from '../core/services/ia-services.service';
import { WorkflowService }        from '../core/services/workflow.service';
import { Dataset }                from '../models/Dataset.model';
import { RecentUpload } from '../models/upload.model';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

const ACCEPTED_EXTS = ['.csv', '.xlsx', '.xls'];
const MAX_SIZE_MB   = 100;

@Component({
  selector   : 'app-upload',
  standalone : true,
  imports    : [CommonModule, RouterModule, TranslocoPipe],
  templateUrl: './upload.component.html',
  styleUrl   : './upload.component.css'
})
export class UploadComponent implements OnInit {

  selectedFile : File | null = null;
  fileSize                   = '';
  isCsv                      = false;
  isDragging                 = false;
  uploadStatus  : UploadStatus = 'idle';
  uploadProgress               = 0;
  errorMessage                 = '';
  lastDataset: Dataset | null  = null;
  recentUploads: RecentUpload[] = [];

  constructor(
    private http     : HttpClient,
    private toastr   : ToastrService,
    private auth     : AuthService,
    private iaService: IaServicesService,
    private wf       : WorkflowService,
    private translocoService: TranslocoService
  ) {}

  ngOnInit(): void {
    this.loadRecentDatasets();
  }

  //Charger les 5 derniers imports
  private loadRecentDatasets(): void {
    this.iaService.getMyDatasets(1, 5).subscribe({
      next: (res) => {
        this.recentUploads = res.datasets.map(d => ({
          id    : d.id,
          name  : d.original_filename,
          date  : new Date(d.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'short',
                    hour: '2-digit', minute: '2-digit'
                  }),
          size  : this.formatSize(d.file_size),
          type  : d.file_type === 'csv' ? 'csv' : 'xlsx',
          status: d.status
        }));
      },
      error: () => {}
    });
  }

  //Drag & Drop events
  onDragOver(e: DragEvent): void  { e.preventDefault(); e.stopPropagation(); this.isDragging = true;  }
  onDragLeave(e: DragEvent): void { e.preventDefault(); e.stopPropagation(); this.isDragging = false; }

  onDrop(e: DragEvent): void {
    e.preventDefault(); e.stopPropagation();
    this.isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.setFile(file);
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (file) this.setFile(file);
    input.value = '';
  }

  //Valider et stocker le fichier
  private setFile(file: File): void {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!ACCEPTED_EXTS.includes(ext)) {
      const msg = this.translocoService.getActiveLang() === 'fr'
        ? `Format non supporté : ${ext}. Utilisez CSV, XLSX ou XLS.`
        : `Unsupported format: ${ext}. Use CSV, XLSX or XLS.`;
      this.toastr.error(msg,
        this.translocoService.translate('upload.fileInvalid'), { timeOut: 4000, progressBar: true });
      return;
    }

    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > MAX_SIZE_MB) {
      const msg = this.translocoService.getActiveLang() === 'fr'
        ? `Le fichier dépasse ${MAX_SIZE_MB} MB (${sizeMB.toFixed(1)} MB).`
        : `File exceeds ${MAX_SIZE_MB} MB (${sizeMB.toFixed(1)} MB).`;
      this.toastr.error(msg,
        this.translocoService.translate('upload.fileTooLarge'), { timeOut: 4000, progressBar: true });
      return;
    }

    this.selectedFile   = file;
    this.fileSize       = this.formatSize(file.size);
    this.isCsv          = ext === '.csv';
    this.uploadStatus   = 'idle';
    this.uploadProgress = 0;
    this.lastDataset    = null;

    this.toastr.info(
      this.translocoService.getActiveLang() === 'fr'
        ? `${file.name} sélectionné (${this.fileSize})`
        : `${file.name} selected (${this.fileSize})`,
      this.translocoService.translate('upload.fileReady'), { timeOut: 2500, progressBar: true });
  }

  //Supprimer le fichier sélectionné
  removeFile(): void {
    this.selectedFile   = null;
    this.fileSize       = '';
    this.uploadStatus   = 'idle';
    this.uploadProgress = 0;
    this.errorMessage   = '';
    this.lastDataset    = null;
  }

  reset(): void {
    this.removeFile();
    this.loadRecentDatasets();
  }

  //Upload vers ia-serv
  uploadFile(): void {
    if (!this.selectedFile) return;

    const token = this.auth.getToken();
    if (!token) {
      this.uploadStatus = 'error';
      this.errorMessage = this.translocoService.translate('upload.sessionExpired');
      this.toastr.error(this.errorMessage, this.translocoService.translate('upload.notAuthenticated'), { timeOut: 5000, progressBar: true });
      return;
    }

    this.uploadStatus   = 'uploading';
    this.uploadProgress = 0;
    this.errorMessage   = '';

    //Utilise IaServicesService.uploadFile()
    const req = this.iaService.uploadFile(this.selectedFile, token);

    this.http.request<Dataset>(req).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress = Math.round(100 * event.loaded / event.total);
        }
        if (event.type === HttpEventType.Response && event.body) {
          this.lastDataset  = event.body;
          this.uploadStatus = 'success';
          this.wf.setDatasetId(event.body.id); // Set the workflow context
          const msg = this.translocoService.getActiveLang() === 'fr'
            ? `${this.selectedFile?.name} importé ! ID : #${event.body.id}`
            : `${this.selectedFile?.name} imported! ID: #${event.body.id}`;
          this.toastr.success(msg,
            this.translocoService.translate('upload.importSuccess'), { timeOut: 5000, progressBar: true }
          );
          this.loadRecentDatasets();
          // Unlock next workflow step
          this.wf.completeCurrentStep();
        }
      },
      error: (err) => {
        this.uploadStatus = 'error';
        this.errorMessage = err.error?.detail || this.translocoService.translate('upload.importError');
        this.toastr.error(this.errorMessage, this.translocoService.translate('upload.importError'), { timeOut: 5000, progressBar: true });
      }
    });
  }

  //Supprimer un dataset depuis la sidebar
  deleteDataset(id: number, name: string): void {
    this.iaService.deleteDataset(id).subscribe({
      next: () => {
        this.recentUploads = this.recentUploads.filter(r => r.id !== id);
        const msg = this.translocoService.getActiveLang() === 'fr'
          ? `${name} supprimé.`
          : `${name} deleted.`;
        this.toastr.success(msg, this.translocoService.translate('upload.deleteSuccess'), { timeOut: 3000, progressBar: true });
      },
      error: () => {
        this.toastr.error(this.translocoService.translate('datasets.deleteError'), this.translocoService.translate('common.error'), { timeOut: 3000, progressBar: true });
      }
    });
  }

  //Helpers
  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      UPLOADED  : 'status-uploaded',
      PROCESSING: 'status-processing',
      PROCESSED : 'status-processed',
      FAILED    : 'status-failed'
    };
    return map[status] ?? '';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      UPLOADED  : '⏳',
      PROCESSING: '🔄',
      PROCESSED : '✓',
      FAILED    : '✗'
    };
    return map[status] ?? '?';
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
