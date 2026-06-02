import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-reset-password-confirm',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslocoPipe],
  templateUrl: './reset-password-confirm.component.html',
  styleUrls: ['./reset-password-confirm.component.css']
})
export class ResetPasswordConfirmComponent implements OnInit {
  resetForm: FormGroup;
  errorMsg = '';
  successMsg = '';
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;
  token = '';

  passwordStrength = 0;
  passwordStrengthLabel = '';
  passwordStrengthColor = '#E2E8F0';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private translocoService: TranslocoService
  ) {
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.errorMsg = this.translocoService.translate('resetPasswordConfirm.invalidToken');
    }

    this.resetForm.get('password')?.valueChanges.subscribe(val => {
      this.calculateStrength(val);
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    if (password !== confirmPassword) {
      control.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  calculateStrength(password: string): void {
    if (!password) {
      this.passwordStrength = 0;
      this.passwordStrengthLabel = '';
      this.passwordStrengthColor = '#E2E8F0';
      return;
    }

    let strength = 0;
    if (password.length > 7) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    this.passwordStrength = strength;

    switch (strength) {
      case 1:
        this.passwordStrengthLabel = this.translocoService.translate('resetPasswordConfirm.strength.weak');
        this.passwordStrengthColor = '#EF4444';
        break;
      case 2:
        this.passwordStrengthLabel = this.translocoService.translate('resetPasswordConfirm.strength.medium');
        this.passwordStrengthColor = '#F59E0B';
        break;
      case 3:
      case 4:
        this.passwordStrengthLabel = this.translocoService.translate('resetPasswordConfirm.strength.strong');
        this.passwordStrengthColor = '#10B981';
        break;
      default:
        this.passwordStrengthLabel = '';
        this.passwordStrengthColor = '#E2E8F0';
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onSubmit(): void {
    if (this.resetForm.invalid || !this.token) return;

    this.isLoading = true;
    this.errorMsg = '';
    this.successMsg = '';

    const { password } = this.resetForm.value;

    this.authService.resetPassword(this.token, password).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMsg = this.translocoService.translate('resetPasswordConfirm.successMsg');
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 0) {
          this.errorMsg = this.translocoService.translate('resetPasswordConfirm.connectionError');
        } else {
          this.errorMsg = err?.error?.detail || this.translocoService.translate('resetPasswordConfirm.expiredToken');
        }
      }
    });
  }

  get password() { return this.resetForm.get('password'); }
  get confirmPassword() { return this.resetForm.get('confirmPassword'); }
}
