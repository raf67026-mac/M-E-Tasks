import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

type Options = {
  auth?: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private base = (environment.apiUrl || '').replace(/\/+$/, ''); // remove trailing slash

  constructor(private http: HttpClient) {}

  private getToken(): string | null {
   
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem('token');
    } catch {
      return null;
    }
  }

  private headers(options?: Options): HttpHeaders {
    let h = new HttpHeaders({ 'Content-Type': 'application/json' });

    if (options?.auth) {
      const token = this.getToken();
      if (token) h = h.set('Authorization', `Bearer ${token}`);
    }

    return h;
  }

  get<T>(url: string, options?: Options) {
    return this.http.get<T>(this.base + url, { headers: this.headers(options) });
  }

  post<T>(url: string, body: any, options?: Options) {
    return this.http.post<T>(this.base + url, body, { headers: this.headers(options) });
  }

  patch<T>(url: string, body: any, options?: Options) {
    return this.http.patch<T>(this.base + url, body, { headers: this.headers(options) });
  }

  delete<T>(url: string, options?: Options) {
    return this.http.delete<T>(this.base + url, { headers: this.headers(options) });
  }
}