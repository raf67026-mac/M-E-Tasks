import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  standalone: true,
  selector: 'app-auth',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './auth.page.html',
  styleUrls: ['./auth.page.scss'],
})
export class AuthPage {
  email = '';
  password = '';
  loading = false;
  error = '';

  showPass = false;

  constructor(private api: ApiService, private router: Router) {}

  togglePass(): void {
    this.showPass = !this.showPass;
  }

  login(): void {
    if (!this.email || !this.password) return;

    this.loading = true;
    this.error = '';

    this.api.post<{ token: string }>('/auth/login', {
      email: this.email,
      password: this.password,
    }).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        this.router.navigateByUrl('/home');
      },
      error: () => {
        this.loading = false;
        this.error = 'Invalid email or password';
      },
      complete: () => {
        this.loading = false;
      },
    });
  }
}
