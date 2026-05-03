import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  user = {
    firstName: '',
    lastName: '',
    email: '',
    jobTitle: '',
    organization: '',
    role: ''
  };

  get initials(): string {
    const f = this.user.firstName?.charAt(0) ?? '';
    const l = this.user.lastName?.charAt(0) ?? '';
    return (f + l).toUpperCase() || 'U';
  }
  stats = {
    analyses: 0,
    dashboards: 0,
    kpis: 0
  };
  passwords = {
    current: '',
    newPwd: '',
    confirm: ''
  };

  showCurrentPwd = false;
  showNewPwd = false;
  showConfirmPwd = false;

  preferences = {
    language: 'en',
    timezone: 'Africa/Tunis',
    emailNotif: true,
    twoFactor: false
  };

  // ── Photo ──
  avatarUrl: string | null = null;

  isSavingPersonal = false;
  isSavingPassword = false;

  successPersonal = '';
  errorPersonal = '';

  successPassword = '';
  errorPassword = '';

  successPreferences = '';

  constructor(private authService: AuthService, private toastr: ToastrService) { }
  ngOnInit(): void {
    // Load avatar from local storage
    this.avatarUrl = localStorage.getItem('user_avatar') || null;

    // Load preferences from local storage
    const savedPrefs = localStorage.getItem('preferences');
    if (savedPrefs) {
      try {
        this.preferences = { ...this.preferences, ...JSON.parse(savedPrefs) };
      } catch { /* ignore */ }
    }

    this.authService.loadUserMe().subscribe({
      next: (me) => {
        // full_name from backend: split into firstName / lastName
        const parts = (me.full_name ?? '').split(' ');
        this.user.firstName = parts[0] ?? '';
        this.user.lastName = parts.slice(1).join(' ');
        this.user.email = me.email;
        this.user.role = me.is_superuser ? 'admin' : 'analyst';
      },
      error: () => {
      }
    });
  }

  // ── Photo upload (client-side) ──
  triggerPhotoUpload(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Validate file size (max 2 MB)
      if (file.size > 2 * 1024 * 1024) {
        this.toastr.error('La taille de l\'image ne doit pas dépasser 2 Mo.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        this.avatarUrl = reader.result as string;
        localStorage.setItem('user_avatar', this.avatarUrl);
        this.toastr.success('Photo de profil mise à jour !');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  removePhoto(): void {
    this.avatarUrl = null;
    localStorage.removeItem('user_avatar');
    this.toastr.info('Photo de profil supprimée.');
  }

  savePersonal(): void {
    this.successPersonal = '';
    this.errorPersonal = '';

    if (!this.user.firstName.trim() || !this.user.lastName.trim()) {
      this.errorPersonal = 'Le prénom et le nom sont obligatoires.';
      return;
    }

    this.isSavingPersonal = true;

    // combine firstName + lastName back into full_name for the backend
    const fullName = `${this.user.firstName.trim()} ${this.user.lastName.trim()}`.trim();
    this.authService.updateMe({
      full_name: fullName || null,
      email: this.user.email.trim()
    }).subscribe({
      next: () => {
        this.isSavingPersonal = false;
        this.successPersonal = 'Profil mis à jour avec succès.';
        setTimeout(() => this.successPersonal = '', 3000);
      },
      error: (err) => {
        this.isSavingPersonal = false;
        this.errorPersonal = err.error?.detail || 'Erreur lors de la mise à jour.';
      }
    });
  }
  changePassword(): void {
    this.successPassword = '';
    this.errorPassword = '';

    if (!this.passwords.current) {
      this.errorPassword = 'Le mot de passe actuel est obligatoire.'; return;
    }
    if (!this.passwords.newPwd || this.passwords.newPwd.length < 8) {
      this.errorPassword = 'Le nouveau mot de passe doit contenir au moins 8 caractères.'; return;
    }
    if (this.passwords.newPwd !== this.passwords.confirm) {
      this.errorPassword = 'Les mots de passe ne correspondent pas.'; return;
    }

    this.isSavingPassword = true;

    this.authService.updatePassword({
      current_password: this.passwords.current,
      new_password: this.passwords.newPwd
    }).subscribe({
      next: () => {
        this.isSavingPassword = false;
        this.successPassword = 'Mot de passe modifié avec succès.';
        this.passwords = { current: '', newPwd: '', confirm: '' };
        setTimeout(() => this.successPassword = '', 3000);
      },
      error: (err) => {
        this.isSavingPassword = false;
        if (err.status === 400) {
          this.errorPassword = 'Mot de passe actuel incorrect.';
        } else {
          this.errorPassword = err.error?.detail || 'Erreur lors du changement.';
        }
      }
    });
  }
  savePreferences(): void {
    localStorage.setItem('preferences', JSON.stringify(this.preferences));
    this.successPreferences = 'Préférences enregistrées avec succès.';
    this.toastr.success('Préférences enregistrées !');
    setTimeout(() => this.successPreferences = '', 3000);
  }

  // ==== Delete Account ====
  showDeleteModal = false;
  isDeletingAccount = false;
  deleteAccountError = '';

  confirmDeleteAccount(): void {
    this.showDeleteModal = true;
    this.deleteAccountError = '';
  }

  cancelDeleteAccount(): void {
    this.showDeleteModal = false;
    this.deleteAccountError = '';
  }

  deleteAccount(): void {
    this.isDeletingAccount = true;
    this.deleteAccountError = '';

    this.authService.deleteMe().subscribe({
      next: () => {
        this.isDeletingAccount = false;
        this.authService.clearSession();
        window.location.href = '/login'; // hard redirect to clear state
      },
      error: (err) => {
        this.isDeletingAccount = false;
        this.deleteAccountError = err.error?.detail || 'Erreur lors de la suppression de votre compte.';
      }
    });
  }
}
