import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserPublic } from '../../../models/user.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-admin-users-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-users-list.component.html',
  styleUrls: ['./admin-users-list.component.css']
})
export class AdminUserListComponent implements OnInit {

  Math = Math;
  users        : UserPublic[] = [];
  filteredUsers: UserPublic[] = [];

  searchTerm  = '';
  isLoading   = true;
  errorMsg    = '';
  successMsg  = '';

  currentPage = 1;
  pageSize    = 10;
  totalUsers  = 0;

  userToDelete   : UserPublic | null = null;
  showDeleteModal = false;
  isDeleting      = false;

  constructor(
    private authService: AuthService,
    private router     : Router,
    private toastr     : ToastrService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  // ── Charger la liste ─────────────────────────────────────
  loadUsers(): void {
    this.isLoading = true;
    this.errorMsg  = '';

    this.authService.getAllUsers(0, 1000).subscribe({
      next: (response) => {
        this.isLoading  = false;
        this.users      = response.data;
        this.totalUsers = response.count;
        this.filterUsers();
      },
      error: () => {
        this.isLoading = false;
        this.errorMsg  = "Erreur lors du chargement des utilisateurs. Vérifiez vos permissions.";
        this.toastr.error(
          "Impossible de charger les utilisateurs.",
          'Erreur de chargement',
          { timeOut: 4000, progressBar: true }
        );
      }
    });
  }


  filterUsers(): void {
    if (!this.searchTerm) {
      this.filteredUsers = this.users;
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredUsers = this.users.filter(u =>
        (u.email     && u.email.toLowerCase().includes(term))    ||
        (u.full_name && u.full_name.toLowerCase().includes(term))
      );
    }
  }

  get paginatedUsers(): UserPublic[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }


  editUser(user: UserPublic): void {
    this.router.navigate(['/admin/users', user.id, 'edit']);
  }

  confirmDelete(user: UserPublic): void {
    this.userToDelete   = user;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.userToDelete   = null;
    this.errorMsg       = '';
  }

  deleteUser(): void {
    if (!this.userToDelete) return;

    this.isDeleting = true;
    const name      = this.userToDelete.full_name || this.userToDelete.email;

    this.authService.deleteUserById(this.userToDelete.id).subscribe({
      next: () => {
        this.isDeleting      = false;
        this.showDeleteModal = false;
        this.userToDelete    = null;

        this.successMsg = "L'utilisateur a été supprimé avec succès.";
        setTimeout(() => this.successMsg = '', 3000);

        this.toastr.success(
          `${name} a été supprimé.`,
          'Suppression réussie ',
          { timeOut: 3000, progressBar: true }
        );

        this.loadUsers();
      },
      error: () => {
        this.isDeleting      = false;
        this.showDeleteModal = false;
        this.errorMsg        = "Erreur lors de la suppression de l'utilisateur.";

        this.toastr.error(
          "Impossible de supprimer cet utilisateur.",
          'Erreur de suppression ',
          { timeOut: 5000, progressBar: true }
        );
      }
    });
  }
}
