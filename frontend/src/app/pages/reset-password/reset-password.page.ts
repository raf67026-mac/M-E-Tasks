import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.page.html',
  styleUrl: './reset-password.page.scss',
})
export class ResetPasswordPage {
  token = '';
  newPassword = '';
  loading = false;
  ok = '';
  error = '';

  constructor(private route: ActivatedRoute, private auth: AuthService) {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }

  submit() {
    if (!this.token) {
      this.error = 'Missing token. Please use the link from your email.';
      return;
    }
    if (!this.newPassword || this.newPassword.length < 6) {
      this.error = 'Password must be at least 6 characters.';
      return;
    }

    this.loading = true;
    this.ok = '';
    this.error = '';

    this.auth.resetPassword(this.token, this.newPassword).subscribe({
      next: () => {
        this.ok = 'Password updated ✅ You can log in now.';
        this.loading = false;
      },
      error: (e: any) => {
        this.error = e?.error?.message || 'Failed to update password';
        this.loading = false;
      },
    });
  }
}