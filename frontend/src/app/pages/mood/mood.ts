import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

// Backend Prisma enum Mood is UPPERCASE:
// HAPPY, CALM, NEUTRAL, SAD, STRESSED, TIRED
// UI will only show: HAPPY, NEUTRAL (Normal), TIRED
type Mood = 'HAPPY' | 'NEUTRAL' | 'TIRED';
type Energy = 'LOW' | 'MEDIUM' | 'HIGH';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './mood.html',
  styleUrls: ['./mood.css'],
})
export class MoodPage implements OnInit {
  selectedMood: Mood | '' = '';
  selectedEnergy: Energy | '' = '';

  saving = false;
  error = '';

  toastOpen = false;
  toastText = '';
  toastEmoji = '✅';

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  private normalizeMood(value: any): Mood | '' {
    if (!value) return '';

    const raw = String(value).trim();

    // Accept whatever comes (old local values / old backend values)
    const u = raw.toUpperCase();

    // Map old/legacy values to new enum
    if (u === 'NORMAL' || u === 'NEUTRAL') return 'NEUTRAL';
    if (u === 'HAPPY') return 'HAPPY';
    if (u === 'TIRED') return 'TIRED';

    // If backend ever returns SAD (old), map it to NEUTRAL since you removed it
    if (u === 'SAD') return 'NEUTRAL';

    return '';
  }

  private normalizeEnergy(value: any): Energy | '' {
    if (!value) return '';
    const u = String(value).trim().toUpperCase();
    if (u === 'LOW' || u === 'MEDIUM' || u === 'HIGH') return u as Energy;
    return '';
  }

  load(): void {
    this.api.get<any>('/users/me', { auth: true }).subscribe({
      next: (res) => {
        const u = res?.user ?? res;

        this.selectedMood = this.normalizeMood(u?.mood);
        this.selectedEnergy = this.normalizeEnergy(u?.energy);

        this.cdr.detectChanges();
      },
      error: () => {
        // ignore load error silently (same as before)
      },
    });
  }

  selectMood(m: Mood): void {
    this.selectedMood = m;
    this.error = '';
  }

  selectEnergy(e: Energy): void {
    this.selectedEnergy = e;
    this.error = '';
  }

  save(): void {
    if (!this.selectedMood || !this.selectedEnergy) {
      this.error = 'Please choose mood and energy 🙂';
      this.toastEmoji = '⚠️';
      this.openToast('Pick both mood + energy first.', true);
      return;
    }

    this.saving = true;
    this.error = '';

    // IMPORTANT: send UPPERCASE mood/energy to match backend enums
    const body = {
      mood: this.selectedMood,                 // e.g., "NEUTRAL"
      energy: this.selectedEnergy.toUpperCase() // e.g., "MEDIUM"
    };

    this.api.post<any>('/users/me', body, { auth: true }).subscribe({
      next: () => {
        setTimeout(() => {
          this.saving = false;
          this.toastEmoji = '✅';
          this.toastOpen = true;
          this.toastText = 'Your mood & energy were saved.';

          // Auto-open energy lane in Home
          try {
            localStorage.setItem('me_openEnergy', this.selectedEnergy);
            localStorage.setItem('me_openFromMood', '1');
          } catch {}

          // Update local snapshot for Home header
          try {
            const raw = localStorage.getItem('me_snapshot');
            const snap = raw ? JSON.parse(raw) : {};
            snap.mood = this.selectedMood;       // store as UPPERCASE
            snap.energy = this.selectedEnergy;   // store as UPPERCASE
            localStorage.setItem('me_snapshot', JSON.stringify(snap));
          } catch {}

          this.router.navigateByUrl('/home');
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        setTimeout(() => {
          console.error('SAVE ERROR:', err);
          this.saving = false;

          if (err?.status === 401) {
            this.error = 'You are not logged in. Please login first.';
            this.toastEmoji = '⚠️';
            this.toastText = 'Login first (missing token).';
            this.toastOpen = true;
            this.cdr.detectChanges();
            return;
          }

          this.error = 'Could not save. Please try again.';
          this.toastEmoji = '⚠️';
          this.toastText = 'Could not save (server error).';
          this.toastOpen = true;

          this.cdr.detectChanges();
        }, 0);
      },
    });
  }

  closeToast(): void {
    this.toastOpen = false;
  }

  goHome(): void {
    this.router.navigateByUrl('/home');
  }

  moodLabel(m: Mood | ''): string {
    if (!m) return '—';
    const map: Record<Mood, string> = {
      HAPPY: 'Happy',
      NEUTRAL: 'Normal',
      TIRED: 'Tired',
    };
    return map[m];
  }

  energyLabel(e: Energy | ''): string {
    if (!e) return '—';
    const map: Record<Energy, string> = {
      LOW: 'Low',
      MEDIUM: 'Medium',
      HIGH: 'High',
    };
    return map[e];
  }

  private openToast(msg: string, autoClose: boolean): void {
    this.toastText = msg;
    this.toastOpen = true;

    if (autoClose) {
      setTimeout(() => (this.toastOpen = false), 2500);
    }
  }
}