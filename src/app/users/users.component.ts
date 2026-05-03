import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/services/auth.service';
import { UserCreate, UserPublic, UsersPublic } from '../models/user.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent implements OnInit {
  users: UserPublic[] = [];
  total = 0;
  loading = false;
  error = '';

  newUser: UserCreate = {
    email: '',
    password: '',
    full_name: '',
    is_active: true,
    is_superuser: false,
  };

  creating = false;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    if (!this.auth.isSuperuser()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    this.auth.getAllUsers().subscribe({
      next: (res: UsersPublic) => {
        this.users = res.data;
        this.total = res.count;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.detail || 'Erreur lors du chargement des utilisateurs.';
      },
    });
  }

  create(): void {
    this.error = '';
    if (!this.newUser.email || !this.newUser.password) {
      this.error = 'Email et mot de passe sont obligatoires.';
      return;
    }
    this.creating = true;
    this.auth.createUser(this.newUser).subscribe({
      next: () => {
        this.creating = false;
        this.newUser = {
          email: '',
          password: '',
          full_name: '',
          is_active: true,
          is_superuser: false,
        };
        this.loadUsers();
      },
      error: (err) => {
        this.creating = false;
        this.error = err?.error?.detail || 'Erreur lors de la création de l’utilisateur.';
      },
    });
  }

  deleteUser(user: UserPublic): void {
    if (!confirm(`Supprimer l'utilisateur ${user.email} ?`)) return;
    this.auth.deleteUserById(user.id).subscribe({
      next: () => this.loadUsers(),
      error: (err) => {
        this.error = err?.error?.detail || 'Erreur lors de la suppression.';
      },
    });
  }
}

