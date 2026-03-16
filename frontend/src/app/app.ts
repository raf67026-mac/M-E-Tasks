import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements OnInit {
  private themeKey = 'tm_theme_v1';

  ngOnInit(): void {
    this.applyThemeFromStorage();
  }

  toggleTheme(): void {
    if (typeof document === 'undefined') return;

    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);

    try {
      localStorage.setItem(this.themeKey, next);
    } catch {
      
    }
  }

  private applyThemeFromStorage(): void {
    if (typeof document === 'undefined') return;

    let saved = 'dark';
    try {
      saved = localStorage.getItem(this.themeKey) || 'dark';
    } catch {
      saved = 'dark';
    }

    document.documentElement.setAttribute('data-theme', saved);
  }
}
