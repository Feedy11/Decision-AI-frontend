import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../core/services/auth.service';
import { Dataset, DatasetListResponse } from '../models/Dataset.model';
import { IA_API_BASE } from '../core/config/api-base';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-datasets-list',
  imports: [CommonModule, FormsModule, RouterModule, TranslocoPipe],
  templateUrl: './datasets-list.component.html',
  styleUrl: './datasets-list.component.css'
})
export class DatasetsListComponent implements OnInit {
   Math = Math;

  private readonly IA_API = IA_API_BASE;

  //Données
  allDatasets     : Dataset[] = [];
  filteredDatasets: Dataset[] = [];
//Tabs
  activeTab = 'mine';
  isAdmin   = false;
  totalAll  = 0;

  // Recherche
  searchTerm = '';

  //Pagination
  currentPage = 1;
  pageSize    = 10;

  //States
  isLoading = false;

  //Suppression
  showDeleteModal  = false;
  isDeleting       = false;
  datasetToDelete  : Dataset | null = null;

  // User name resolution
  userNames: Record<string, string> = {};

  constructor(
    private http    : HttpClient,
    private toastr  : ToastrService,
    private auth    : AuthService,
    private translocoService: TranslocoService
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.isSuperuser();
    // Admin defaults to seeing all datasets
    if (this.isAdmin) {
      this.activeTab = 'all';
      this.loadUserNames();
    }
    this.loadDatasets();
  }

  // Load user names for the owner column
  private loadUserNames(): void {
    this.auth.getAllUsers(0, 200).subscribe({
      next: (res) => {
        for (const u of res.data) {
          this.userNames[u.id] = u.full_name || u.email;
        }
      },
      error: () => {} // silently ignore — fallback to ID display
    });
  }

  // Get display name for a user_id
  getUserName(userId: string | null | undefined): string {
    if (!userId) return 'N/A';
    return this.userNames[userId] || `#${userId}`;
  }

  //Changer de tab
  setTab(tab: string): void {
    this.activeTab  = tab;
    this.currentPage = 1;
    this.loadDatasets();
  }

  //Charger les datasets
  loadDatasets(): void {
    this.isLoading = true;

    // Admin → tous | Utilisateur → ses fichiers seulement
    const url = (this.activeTab === 'all' && this.isAdmin)
      ? `${this.IA_API}/datasets?page=1&page_size=100`
      : `${this.IA_API}/datasets/my-datasets?page=1&page_size=100`;

    this.http.get<DatasetListResponse>(url).subscribe({
      next: (res) => {
        this.isLoading       = false;
        this.allDatasets     = res.datasets;
        this.totalAll        = res.total;
        this.filteredDatasets = res.datasets;
        this.onSearch();
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error(
          this.translocoService.translate('datasets.loadError'),
          this.translocoService.translate('common.error'),
          { timeOut: 4000, progressBar: true }
        );
      }
    });
  }

  //Recherche
  onSearch(): void {
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredDatasets = term
      ? this.allDatasets.filter(d =>
          d.original_filename.toLowerCase().includes(term) ||
          d.file_type.toLowerCase().includes(term)
        )
      : [...this.allDatasets];
    this.currentPage = 1;
  }

  //Pagination
  get paginatedDatasets(): Dataset[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredDatasets.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredDatasets.length / this.pageSize));
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  //Suppression
  confirmDelete(d: Dataset): void {
    this.datasetToDelete = d;
    this.showDeleteModal  = true;
  }

  cancelDelete(): void {
    this.datasetToDelete = null;
    this.showDeleteModal  = false;
  }

  // DELETE
  deleteDataset(): void {
    if (!this.datasetToDelete) return;
    this.isDeleting = true;

    this.http.delete(`${this.IA_API}/datasets/${this.datasetToDelete.id}`)
      .subscribe({
        next: () => {
          this.isDeleting      = false;
          this.showDeleteModal  = false;
          const msg = this.translocoService.getActiveLang() === 'fr'
            ? `${this.datasetToDelete?.original_filename} supprimé.`
            : `${this.datasetToDelete?.original_filename} deleted.`;
          this.toastr.success(
            msg,
            this.translocoService.translate('datasets.deleteSuccess'),
            { timeOut: 3000, progressBar: true }
          );
          this.datasetToDelete = null;
          this.loadDatasets();
        },
        error: () => {
          this.isDeleting     = false;
          this.showDeleteModal = false;
          this.toastr.error(
            this.translocoService.translate('datasets.deleteError'),
            this.translocoService.translate('common.error'),
            { timeOut: 4000, progressBar: true }
          );
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

  formatSize(bytes: number): string {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

}

