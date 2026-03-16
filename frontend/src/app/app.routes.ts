import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'auth', pathMatch: 'full' },

  {
    path: 'auth',
    loadComponent: () => import('./pages/auth/auth.page').then((m) => m.AuthPage),
  },

  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
  },

  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },

  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
  },

  {
    path: 'mood',
    loadComponent: () => import('./pages/mood/mood').then((m) => m.MoodPage),
  },

  {
    path: 'home',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },

  {
    path: 'add-task',
    loadComponent: () => import('./pages/add-task/add-task').then((m) => m.AddTask),
  },

  {
    path: 'edit-profile',
    loadComponent: () => import('./pages/edit-profile/edit-profile').then((m) => m.EditProfile),
  },

  { path: '**', redirectTo: 'auth' },
];