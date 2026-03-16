import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  standalone: true,
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.css'],
})
export class ForgotPassword {
  email = '';
  loading = false;

  error = '';
  success = '';

  constructor(private api: ApiService) {}

  submit(): void {
    if (!this.email) return;

    this.loading = true;
    this.error = '';
    this.success = '';

    this.api
      .post<{ message?: string }>('/auth/forgot-password', { email: this.email })
      .subscribe({
        next: (res) => {
          this.success =
            res?.message ||
            'Reset email sent. Please check your inbox ✨';
        },
        error: (err) => {
          this.error =
            err?.error?.message ||
            'Could not send reset email. Try again.';
        },
        complete: () => {
          this.loading = false;
        },
      });
  }
}
