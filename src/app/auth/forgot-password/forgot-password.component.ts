import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent implements OnDestroy {

  step = 1;    // 1 = enter email, 2 = confirmation shown
  email = '';
  emailError = '';
  errorMsg = '';
  isLoading = false;
  resendCooldown = 0;
  resetLink      = '';

  private cooldownTimer: any = null;

  constructor(private authService: AuthService) { }

  /**
   * POST /api/v1/password-recovery/{email}
   * Always succeeds (backend never reveals whether the email exists).
   */
  sendResetLink(): void {
    // Basic validation
    this.emailError = '';
    this.errorMsg = '';

    if (!this.email.trim()) {
      this.emailError = 'L\'adresse email est obligatoire.';
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email.trim())) {
      this.emailError = 'Format d\'email invalide.';
      return;
    }

    this.isLoading = true;

    this.authService.forgotPassword(this.email.trim()).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.step      = 2;
        // DEV: if backend returns a reset link directly (SMTP not configured)
        if (res.message && res.message.startsWith('http')) {
          this.resetLink = res.message;
        } else {
          this.resetLink = '';
        }
        this.startCooldown(60);
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 0) {
          this.errorMsg = 'Impossible de joindre le serveur.';
        } else {
          this.errorMsg = err?.error?.detail || 'Une erreur est survenue.';
        }
      }
    });
  }

  /** Allow resending after cooldown */
  resend(): void {
    this.step = 1;
    this.sendResetLink();
  }

  private startCooldown(seconds = 60): void {
    this.resendCooldown = seconds;
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.cooldownTimer);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  }
}
