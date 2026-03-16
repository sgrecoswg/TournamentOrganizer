import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/leaderboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./features/leaderboard/leaderboard.component').then(m => m.LeaderboardComponent)
  },
  {
    path: 'players',
    loadComponent: () => import('./features/players/players.component').then(m => m.PlayersComponent)
  },
  {
    path: 'players/:id',
    loadComponent: () => import('./features/player-profile/player-profile.component').then(m => m.PlayerProfileComponent)
  },
  {
    path: 'events',
    loadComponent: () => import('./features/events/event-list.component').then(m => m.EventListComponent)
  },
  {
    path: 'events/:id',
    loadComponent: () => import('./features/events/event-detail.component').then(m => m.EventDetailComponent)
  },
  {
    path: 'events/:id/pairings',
    loadComponent: () => import('./features/events/pairings-display.component').then(m => m.PairingsDisplayComponent)
  },
  {
    path: 'checkin/:token',
    loadComponent: () => import('./features/events/qr-checkin.component').then(m => m.QrCheckinComponent)
  },
  {
    path: 'events/:eventId/games/:gameId',
    canActivate: [authGuard],
    loadComponent: () => import('./features/tournament/game-result.component').then(m => m.GameResultComponent)
  },
  {
    path: 'stores',
    canActivate: [authGuard],
    loadComponent: () => import('./features/stores/store-list.component').then(m => m.StoreListComponent)
  },
  {
    path: 'stores/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/stores/store-detail.component').then(m => m.StoreDetailComponent)
  },
  {
    path: 'stores/:id/meta',
    canActivate: [authGuard],
    loadComponent: () => import('./features/stores/commander-meta.component').then(m => m.CommanderMetaComponent)
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/oauth-callback.component').then(m => m.OAuthCallbackComponent)
  }
];
