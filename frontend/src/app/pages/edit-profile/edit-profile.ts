import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  standalone: true,
  selector: 'app-edit-profile',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './edit-profile.html',
  styleUrls: ['./edit-profile.scss'],
})
export class EditProfile implements OnInit {
  name = '';
  username = '';
  email = '';
  newPassword = '';
  confirmPassword = '';

  // Password visibility (same UX as login page)
  showNewPass = false;
  showConfirmPass = false;

  loading = false;
  error = '';
  success = '';

  private initial = { name: '', username: '', email: '' };

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
   
    this.api.get<any>('/users/me', { auth: true }).subscribe({
      next: (res) => {
        const u = res?.user ?? res;
        this.name = u?.name ?? '';
        this.username = u?.username ?? '';
        this.email = u?.email ?? '';

        this.initial = { name: this.name, username: this.username, email: this.email };

        
        setTimeout(() => this.cdr.detectChanges(), 0);
      },
      error: () => {
        // keep defaults; avoid blocking UI
        this.initial = { name: this.name, username: this.username, email: this.email };
      },
    });
  }

    toggleNewPass(): void {
    this.showNewPass = !this.showNewPass;
  }

  toggleConfirmPass(): void {
    this.showConfirmPass = !this.showConfirmPass;
  }

save(): void {
    this.error = '';
    this.success = '';

    if (!this.name.trim()) {
      this.error = 'Name is required.';
      return;
    }
    if (!this.email.trim() || !this.email.includes('@')) {
      this.error = 'Please enter a valid email.';
      return;
    }

    // Optional: change password
    const pw = this.newPassword.trim();
    const pw2 = this.confirmPassword.trim();
    if (pw || pw2) {
      if (!pw || !pw2) {
        this.error = 'Please fill both password fields.';
        return;
      }
      if (pw.length < 6) {
        this.error = 'Password must be at least 6 characters.';
        return;
      }
      if (pw !== pw2) {
        this.error = 'Passwords do not match.';
        return;
      }
    }

    const payload: any = {
      name: this.name.trim(),
      username: this.username.trim(),
      email: this.email.trim(),
    };

    if (pw) payload.password = pw;

    this.loading = true;

    this.api.post<any>('/users/me', payload, { auth: true }).subscribe({
      next: () => {
        setTimeout(() => {
          this.loading = false;
          this.success = 'Saved ✨';
          this.initial = { ...payload };
          
          this.newPassword = '';
          this.confirmPassword = '';
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        console.error('EDIT_PROFILE_SAVE_ERROR:', err);
        setTimeout(() => {
          this.loading = false;
          this.error = err?.error?.message || 'Could not save. Please try again.';
          this.cdr.detectChanges();
        }, 0);
      },
    });
  }

  resetForm(): void {
    this.name = this.initial.name;
    this.username = this.initial.username;
    this.email = this.initial.email;
    this.error = '';
    this.success = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }
}
