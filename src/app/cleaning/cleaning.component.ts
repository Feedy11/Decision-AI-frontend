import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Dataset } from '../models/Dataset.model';
import { CleaningProfile, CleaningProfileCreate, CleaningReport, DataQuality, DEFAULT_PROFILE, ValidationResult } from '../models/Cleaning.model';
import { CleaningService } from '../core/services/cleaning.service';
import { IaServicesService } from '../core/services/ia-services.service';
import { WorkflowService } from '../core/services/workflow.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-cleaning',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cleaning.component.html',
  styleUrl: './cleaning.component.css'
})
export class CleaningComponent implements OnInit {

  //Tabs
  activeTab: 'clean' | 'quality' | 'profiles' | 'history' = 'clean';

  //Datasets dispo
  datasets         : Dataset[] = [];
  selectedDatasetId: number | null = null;

  //Profils
  profiles          : CleaningProfile[] = [];
  selectedProfileId : number | null = null;
  showCreateProfile  = false;
  newProfile        : CleaningProfileCreate = { ...DEFAULT_PROFILE };

  //Nettoyage
  saveAsNew    = false;
  isCleaning   = false;
  cleanResult  : CleaningReport | null = null;

  //Validation
  isValidating     = false;
  validationResult : ValidationResult | null = null;

  //Qualité
  isLoadingQuality = false;
  qualityData      : DataQuality | null = null;

  //Historique
  isLoadingHistory = false;
  history          : CleaningReport[] = [];

  //Profils loading
  isLoadingProfiles = false;
  isSavingProfile   = false;

  constructor(
    private cleaningSvc: CleaningService,
    private iaService  : IaServicesService,
    private toastr     : ToastrService,
    private wf         : WorkflowService,
    private router     : Router
  ) {}

  ngOnInit(): void {
    this.loadDatasets();
    this.loadProfiles();
  }

  //Charger les datasets
  private loadDatasets(): void {
    this.iaService.getMyDatasets(1, 100).subscribe({
      next : (res) => { 
        // If in workflow mode, filter to only show the workflow dataset
        if (this.router.url.includes('/workflow/')) {
          const wfDatasetId = this.wf.getDatasetId();
          if (wfDatasetId) {
            this.datasets = res.datasets.filter(d => d.id === wfDatasetId);
            this.selectedDatasetId = wfDatasetId;
          } else {
            this.datasets = res.datasets; // fallback
          }
        } else {
          this.datasets = res.datasets; 
        }
      },
      error: () => {}
    });
  }

  //Changer de tab
  setTab(tab: 'clean' | 'quality' | 'profiles' | 'history'): void {
    this.activeTab = tab;
    if (tab === 'profiles') this.loadProfiles();
  }

  //Profils
  loadProfiles(): void {
    this.isLoadingProfiles = true;
    this.cleaningSvc.getProfiles().subscribe({
      next : (p) => { this.profiles = p; this.isLoadingProfiles = false; },
      error: () => { this.isLoadingProfiles = false; }
    });
  }

  createProfile(): void {
    if (!this.newProfile.name.trim()) return;
    this.isSavingProfile = true;

    this.cleaningSvc.createProfile(this.newProfile).subscribe({
      next: (p) => {
        this.isSavingProfile   = false;
        this.showCreateProfile = false;
        this.profiles          = [p, ...this.profiles];
        this.newProfile        = { ...DEFAULT_PROFILE };
        this.toastr.success(`Profil "${p.name}" créé.`, 'Succès', { timeOut: 3000, progressBar: true });
      },
      error: () => {
        this.isSavingProfile = false;
        this.toastr.error('Erreur lors de la création.', 'Erreur', { timeOut: 4000, progressBar: true });
      }
    });
  }

  deleteProfile(id: number, name: string): void {
    this.cleaningSvc.deleteProfile(id).subscribe({
      next: () => {
        this.profiles = this.profiles.filter(p => p.id !== id);
        this.toastr.success(`Profil "${name}" supprimé.`, 'Supprimé', { timeOut: 3000, progressBar: true });
      },
      error: () => {
        this.toastr.error('Impossible de supprimer ce profil.', 'Erreur', { timeOut: 4000, progressBar: true });
      }
    });
  }

  //Nettoyage
  cleanDataset(): void {
    if (!this.selectedDatasetId) return;
    this.isCleaning  = true;
    this.cleanResult = null;

    this.cleaningSvc.cleanDataset(
      this.selectedDatasetId,
      this.selectedProfileId ?? undefined,
      this.saveAsNew
    ).subscribe({
      next: (r) => {
        this.isCleaning  = false;
        this.cleanResult = r;
        this.toastr.success(
          `Nettoyage terminé. ${r.rows_before - r.rows_after} lignes supprimées.`,
          'Nettoyage réussi', { timeOut: 5000, progressBar: true }
        );
        // Unlock next workflow step
        this.wf.completeCurrentStep();
      },
      error: (err) => {
        this.isCleaning = false;
        this.toastr.error(err.error?.detail || 'Erreur de nettoyage.', 'Erreur', { timeOut: 5000, progressBar: true });
      }
    });
  }

  //Validation
  validateDataset(): void {
    if (!this.selectedDatasetId) return;
    this.isValidating     = true;
    this.validationResult = null;

    this.cleaningSvc.validateDataset(this.selectedDatasetId).subscribe({
      next: (r) => {
        this.isValidating     = false;
        this.validationResult = r;
        const msg = r.valid ? 'Dataset valide' : `${r.errors.length} erreur(s) détectée(s)`;
        r.valid
          ? this.toastr.success(msg, 'Validation', { timeOut: 3000, progressBar: true })
          : this.toastr.warning(msg, 'Validation', { timeOut: 4000, progressBar: true });
      },
      error: () => {
        this.isValidating = false;
        this.toastr.error('Erreur lors de la validation.', 'Erreur', { timeOut: 4000, progressBar: true });
      }
    });
  }

  //Qualité
  loadQuality(): void {
    if (!this.selectedDatasetId) return;
    this.isLoadingQuality = true;
    this.qualityData      = null;

    this.cleaningSvc.getQuality(this.selectedDatasetId).subscribe({
      next: (q) => { this.isLoadingQuality = false; this.qualityData = q; },
      error: () => {
        this.isLoadingQuality = false;
        this.toastr.error('Erreur lors de l\'analyse qualité.', 'Erreur', { timeOut: 4000, progressBar: true });
      }
    });
  }

  //Historique
  loadHistory(): void {
    if (!this.selectedDatasetId) return;
    this.isLoadingHistory = true;

    this.cleaningSvc.getCleaningHistory(this.selectedDatasetId).subscribe({
      next: (h) => { this.isLoadingHistory = false; this.history = h; },
      error: () => { this.isLoadingHistory = false; }
    });
  }

  //Helpers
  getMissingCols(): { name: string; count: number }[] {
    if (!this.qualityData) return [];
    return Object.entries(this.qualityData.missing_values.by_column)
      .map(([name, count]) => ({ name, count }));
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
