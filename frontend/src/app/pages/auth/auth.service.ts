import { Injectable } from '@angular/core';
import { ApiService } from '../../services/api.service';

export type AuthResponse = { message: string; token: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private api: ApiService) {}

  register(email: string, password: string) {
    return this.api.post<{ message: string; user: any }>('/auth/register', { email, password });
  }

  login(email: string, password: string) {
    return this.api.post<AuthResponse>('/auth/login', { email, password });
  }

  forgotPassword(email: string) {
    return this.api.post<{ message: string }>('/auth/forgot-password', { email });
  }

  resetPassword(token: string, password: string) {
    return this.api.post<{ message: string }>('/auth/reset-password', { token, password });
  }

  saveToken(token: string) {
    localStorage.setItem('token', token);
  }

  logout() {
    localStorage.removeItem('token');
  }

  get token() {
    return localStorage.getItem('token');
  }

  isLoggedIn() {
    return !!this.token;
  }
}