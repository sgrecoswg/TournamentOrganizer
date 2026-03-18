import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CurrentUser, LicenseTier } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<CurrentUser | null>(null);
  currentUser$ = this.userSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('auth_token');
          return;
        }
        this.userSubject.next(this.decodeJwt(token));
      } catch {
        localStorage.removeItem('auth_token');
      }
    }
  }

  storeToken(token: string): void {
    localStorage.setItem('auth_token', token);
    this.userSubject.next(this.decodeJwt(token));
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    this.userSubject.next(null);
  }

  getToken(): string | null {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('auth_token');
        this.userSubject.next(null);
        return null;
      }
    } catch {
      localStorage.removeItem('auth_token');
      this.userSubject.next(null);
      return null;
    }
    return token;
  }

  get currentUser(): CurrentUser | null {
    return this.userSubject.value;
  }

  get isStoreEmployee(): boolean {
    const r = this.currentUser?.role;
    return r === 'StoreEmployee' || r === 'StoreManager' || r === 'Administrator';
  }

  get isStoreManager(): boolean {
    const r = this.currentUser?.role;
    return r === 'StoreManager' || r === 'Administrator';
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'Administrator';
  }

  get licenseTier(): LicenseTier {
    if (this.isAdmin) return 'Tier2';  // admins always have full access
    return this.currentUser?.licenseTier ?? 'Free';
  }

  get isTier1(): boolean {
    return this.licenseTier === 'Tier1' || this.licenseTier === 'Tier2';
  }

  get isTier2(): boolean {
    return this.licenseTier === 'Tier2';
  }

  login(): void {
    // Navigate directly to the backend — bypassing the Angular dev proxy.
    // The OAuth CSRF state cookie is set by the backend and must remain on the
    // same origin (localhost:5021) for the Google callback to validate correctly.
    window.location.href = 'http://localhost:5021/api/auth/google-login';
  }

  private decodeJwt(token: string): CurrentUser {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: +payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      playerId: payload.playerId != null ? +payload.playerId : undefined,
      storeId: payload.storeId != null ? +payload.storeId : undefined,
      licenseTier: payload.licenseTier ?? undefined,
    };
  }
}
