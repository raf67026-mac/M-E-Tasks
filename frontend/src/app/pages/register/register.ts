import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.css'],
})
export class Register {
  username = '';
  email = '';
  password = '';

  loading = false;
  error = '';
  showPass = false;

  constructor(private api: ApiService, private router: Router) {}

  togglePass(): void {
    this.showPass = !this.showPass;
  }

  register(): void {
    if (!this.username || !this.email || !this.password) return;

    this.loading = true;
    this.error = '';

    this.api
      .post<{ token?: string }>('/auth/register', {
        username: this.username,
        email: this.email,
        password: this.password,
      })
      .subscribe({
        next: (res) => {
          
          if (res?.token) {
            localStorage.setItem('token', res.token);
            this.router.navigateByUrl('/home');
            return;
          }
          
          this.router.navigateByUrl('/auth');
        },
        error: (err) => {
          this.loading = false;
          this.error =
            err?.error?.message ||
            'Could not create account. Try another email/username.';
        },
        complete: () => {
          this.loading = false;
        },
      });
  }
}
