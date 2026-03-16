import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';

type EnergyLevel = 'LOW' | 'MEDIUM' | 'HIGH';
type DurationUnit = 'MINUTES' | 'HOURS' | 'DAYS';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-task.html',
  styleUrls: ['./add-task.scss'],
})
export class AddTask {

  title = '';


  durationValue = 30;
  durationUnit: DurationUnit = 'MINUTES';

  
  durationMinutes = 30;

  energyLevel: EnergyLevel = 'LOW';

  saving = false;
  error = '';

 
  toastOpen = false;

 
  durationPill = '30 minutes';

  constructor(private api: ApiService, private router: Router) {
 
    this.onDurationInputChange();
  }

  
  onDurationInputChange(): void {

    const raw = Number(this.durationValue);
    const v = Number.isFinite(raw) ? Math.floor(raw) : 0;

   
    let minutes = v;
    if (this.durationUnit === 'HOURS') minutes = v * 60;
    if (this.durationUnit === 'DAYS') minutes = v * 24 * 60;

   
    const min = 15;
    const max = 30 * 24 * 60;
    minutes = Math.max(min, Math.min(max, minutes));

    
    this.durationMinutes = minutes;

   
    this.energyLevel = this.suggestEnergy(this.durationMinutes);

    
    this.durationPill = this.makeDurationPill();
  }

  private makeDurationPill(): string {
    const v = Number(this.durationValue || 0);

    
    if (this.durationUnit === 'MINUTES') return `${this.durationMinutes} minutes`;

    if (this.durationUnit === 'HOURS') {
   
      const hrs = Math.max(1, Math.round(this.durationMinutes / 60));
      return `${hrs} hour${hrs > 1 ? 's' : ''}`;
    }

 
    const days = Math.max(1, Math.round(this.durationMinutes / (24 * 60)));
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  badgeClass(): string {
    return this.energyLevel === 'HIGH'
      ? 'lvl-high'
      : this.energyLevel === 'MEDIUM'
      ? 'lvl-medium'
      : 'lvl-low';
  }

  goBack(): void {
 
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }
    this.router.navigateByUrl('/home');
  }

  submit(): void {
    this.error = '';

    const title = this.title.trim();
    if (!title) {
      this.error = 'Please enter a task title.';
      return;
    }

    if (this.saving) return;
    this.saving = true;

    
    const payload = {
      title,
      durationMinutes: this.durationMinutes,
      energyLevel: this.energyLevel,
    };

    this.api
      .post('/tasks', payload, { auth: true })
      .pipe(
        timeout(12000),
        finalize(() => (this.saving = false))
      )
      .subscribe({
        next: () => {
         
          this.toastOpen = true;

          
          setTimeout(() => {
            this.router.navigateByUrl('/home');
          }, 900);
        },
        error: (err: any) => {
          const msg =
            err?.error?.error ||
            err?.error?.message ||
            err?.message ||
            'Failed to save. Please try again.';
          this.error = String(msg);
          
          this.toastOpen = true;
          setTimeout(() => (this.toastOpen = false), 2500);
        },
      });
  }

  
  goHome(): void {
    this.router.navigateByUrl('/home');
  }

  
  closeToast(): void {
    this.toastOpen = false;
  }

  private suggestEnergy(minutes: number): EnergyLevel {
    if (minutes <= 60) return 'LOW';
    if (minutes <= 180) return 'MEDIUM';
    return 'HIGH';
  }
}