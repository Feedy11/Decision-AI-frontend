import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reset-password-request',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password-request.component.html',
  styleUrls: ['./reset-password-request.component.css']
})
export class ResetPasswordRequestComponent {
  requestForm: FormGroup;
  errorMsg = '';
  successMsg = '';
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.requestForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.requestForm.invalid) return;

    this.isLoading = true;
    this.errorMsg = '';
    this.successMsg = '';

    const { email } = this.requestForm.value;

    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMsg = 'Un lien de réinitialisation a été envoyé à ' + email;
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 0) {
          this.errorMsg = 'Impossible de joindre le serveur. Vérifiez que le backend est démarré.';
        } else {
          this.errorMsg = err?.error?.detail || 'Une erreur est survenue.';
        }
      }
    });
  }

  get email() { return this.requestForm.get('email'); }
}
