import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';          // ← ajout
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-admin-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslocoPipe],
  templateUrl: './admin-user-form.component.html',
  styleUrls: ['./admin-user-form.component.css']
})
export class AdminUserFormComponent implements OnInit {

  userForm   : FormGroup;
  isEditMode  = false;
  userId     : string | null = null;

  isLoading   = false;
  isSaving    = false;
  errorMsg    = '';
  successMsg  = '';

  constructor(
    private fb         : FormBuilder,
    private authService: AuthService,
    private route      : ActivatedRoute,
    private router     : Router,
    private toastr     : ToastrService,
    private translocoService: TranslocoService
  ) {
    this.userForm = this.fb.group({
      email   : ['', [Validators.required, Validators.email]],
      fullName: ['',  Validators.required],
      password: [''],
      role    : ['user', Validators.required],
      isActive: [true, Validators.required]
    });
  }

  ngOnInit(): void {
    this.userId    = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.userId;

    if (this.isEditMode) {
      this.loadUser();
    } else {
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
      this.userForm.get('password')?.updateValueAndValidity();
    }
  }

  // ── Charger l'utilisateur (mode édition) ─────────────────
  loadUser(): void {
    if (!this.userId) return;

    this.isLoading = true;

    this.authService.getUserById(this.userId).subscribe({
      next: (user) => {
        this.isLoading = false;
        this.userForm.patchValue({
          email   : user.email,
          fullName: user.full_name || '',
          role    : user.is_superuser ? 'admin' : 'user',
          isActive: user.is_active
        });
      },
      error: () => {
        this.isLoading = false;
        this.errorMsg  = this.translocoService.translate('admin.userForm.toastr.loadErrorMessage');
        this.toastr.error(
          this.translocoService.translate('admin.userForm.toastr.loadError'),
          this.translocoService.translate('common.error'),
          { timeOut: 4000, progressBar: true }
        );
      }
    });
  }

  //  Soumettre le formulaire
  onSubmit(): void {
    if (this.userForm.invalid) return;

    this.isSaving  = true;
    this.errorMsg  = '';
    this.successMsg = '';

    const formVal = this.userForm.value;

    //mode update
    if (this.isEditMode && this.userId) {

      const updateData: any = {
        email       : formVal.email,
        full_name   : formVal.fullName,
        is_active   : formVal.isActive,
        is_superuser: formVal.role === 'admin'
      };
      if (formVal.password) updateData.password = formVal.password;

      this.authService.updateUserById(this.userId, updateData).subscribe({
        next: () => {
          this.isSaving   = false;
          this.successMsg = this.translocoService.translate('admin.userForm.toastr.updateSuccessMessage');
          this.toastr.success(
            this.translocoService.translate('admin.userForm.toastr.updatedUser', { name: formVal.fullName }),
            this.translocoService.translate('admin.userForm.toastr.updateSuccessTitle'),
            { timeOut: 3000, progressBar: true }
          );
          setTimeout(() => this.router.navigate(['/admin/users']), 1500);
        },
        error: (err) => {
          this.isSaving  = false;
          this.errorMsg  = err?.error?.detail || this.translocoService.translate('admin.userForm.toastr.updateErrorMessage');
          this.toastr.error(
            this.errorMsg,
            this.translocoService.translate('admin.userForm.toastr.updateErrorTitle'),
            { timeOut: 5000, progressBar: true }
          );
        }
      });

    //creation mode
    } else {

      const createData: any = {
        email       : formVal.email,
        password    : formVal.password,
        full_name   : formVal.fullName,
        is_active   : formVal.isActive,
        is_superuser: formVal.role === 'admin'
      };

      this.authService.createUser(createData).subscribe({
        next: () => {
          this.isSaving   = false;
          this.successMsg = this.translocoService.translate('admin.userForm.toastr.createSuccessMessage');
          this.toastr.success(
            this.translocoService.translate('admin.userForm.toastr.createdUser', { name: formVal.fullName }),
            this.translocoService.translate('admin.userForm.toastr.createSuccessTitle'),
            { timeOut: 3000, progressBar: true }
          );
          setTimeout(() => this.router.navigate(['/admin/users']), 1500);
        },
        error: (err) => {
          this.isSaving  = false;
          this.errorMsg  = err?.error?.detail || this.translocoService.translate('admin.userForm.toastr.createErrorMessage');
          this.toastr.error(
            this.errorMsg,
            this.translocoService.translate('admin.userForm.toastr.createErrorTitle'),
            { timeOut: 5000, progressBar: true }
          );
        }
      });
    }
  }
}
