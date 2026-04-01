import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { CurrentUser, LicenseTier } from '../models/api.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<CurrentUser | null>(null);
  currentUser$ = this.userSubject.asObservable();

  private token: string | null = null; // in-memory only — never written to localStorage

  constructor(private http: HttpClient) {
    this.silentRefresh();
  }

  private silentRefresh(): void {
    this.http.post<{ token: string }>(
      `${environment.apiBase}/api/auth/refresh`,
      {},
      { withCredentials: true }
    ).subscribe({
      next: res => { this.setToken(res.token); },
      error: () => {} // no active session — remain unauthenticated
    });
  }

  private setToken(token: string): void {
    this.token = token;
    this.userSubject.next(this.decodeJwt(token));
  }

  storeToken(token: string): void {
    this.setToken(token);
  }

  logout(): void {
    this.token = null;
    this.userSubject.next(null);
  }

  /** Calls POST /api/auth/logout (revokes cookie server-side) then clears local state. */
  logoutFull(): void {
    this.http.post(`${environment.apiBase}/api/auth/logout`, {}, { withCredentials: true })
      .subscribe({ error: () => {} });
    this.logout();
  }

  getToken(): string | null {
    if (!this.token) return null;
    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        this.token = null;
        this.userSubject.next(null);
        return null;
      }
    } catch {
      this.token = null;
      this.userSubject.next(null);
      return null;
    }
    return this.token;
  }

  /** Calls POST /api/auth/refresh (sends HttpOnly cookie), stores the returned JWT, returns it. */
  refresh(): Observable<string> {
    return this.http.post<{ token: string }>(
      `${environment.apiBase}/api/auth/refresh`,
      {},
      { withCredentials: true }
    ).pipe(
      tap(res => this.storeToken(res.token)),
      map(res => res.token)
    );
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
    if (this.isAdmin) return 'Tier2'; // admins always have full access
    return this.currentUser?.licenseTier ?? 'Free';
  }

  get isTier1(): boolean {
    return this.licenseTier === 'Tier1' || this.licenseTier === 'Tier2';
  }

  get isTier2(): boolean {
    return this.licenseTier === 'Tier2';
  }

  get isTier3(): boolean {
    return this.licenseTier === 'Tier3';
  }

  login(): void {
    // Uses environment.apiBase so the URL is never hardcoded.
    // Dev: apiBase='' → relative /api/auth/google-login forwarded by the proxy.
    // Prod: apiBase='https://api.yourdomain.com' → absolute HTTPS URL.
    window.location.href = `${environment.apiBase}/api/auth/google-login`;
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
