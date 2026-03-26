import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AuthService } from './core/services/auth.service';
import { ApiService } from './core/services/api.service';
import { StoreContextService } from './core/services/store-context.service';
import { LocalStorageContext } from './core/services/local-storage-context.service';
import { ThemeService } from './core/services/theme.service';
import { CurrentUser, StoreDto } from './core/models/api.models';
import { PwaInstallPromptComponent } from './shared/components/pwa-install-prompt.component';
import { NotificationBellComponent } from './shared/components/notification-bell.component';

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatSidenavModule, MatListModule, MatIconModule, MatButtonModule, MatMenuModule,
    MatSelectModule, MatFormFieldModule, MatSnackBarModule,
    PwaInstallPromptComponent,
    NotificationBellComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private apiService = inject(ApiService);
  private storeContext = inject(StoreContextService);
  private ctx = inject(LocalStorageContext);
  private themeService = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);
  private swUpdate = inject(SwUpdate);
  private snackBar = inject(MatSnackBar);
  private userSub!: Subscription;
  private storeNameSub!: Subscription;

  currentUser: CurrentUser | null = null;
  stores: StoreDto[] = [];
  // Fixed per-session timestamp — applied to logo URLs that lack one so the browser
  // re-fetches the image on each app load without thrashing on every getter call.
  private readonly sessionTs = Date.now();

  get selectedStoreId(): number | null { return this.storeContext.selectedStoreId; }
  set selectedStoreId(id: number | null) {
    if (id != null) this.ctx.setActiveStore(id);   // update prefix BEFORE notifying observers
    this.storeContext.setSelectedStoreId(id);
  }

  ngOnInit(): void {
    // Apply any saved localStorage theme immediately (before API responds)
    this.themeService.resolveAndApply(null);

    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => {
          const snack = this.snackBar.open('New version available', 'Reload', { duration: 0 });
          snack.onAction().subscribe(() => window.location.reload());
        });
    }

    this.storeNameSub = this.storeContext.storesChanged$.subscribe(() => {
      this.stores = this.ctx.stores.getAll();
      this.cdr.detectChanges();
    });

    this.userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user?.role === 'Administrator' || user?.storeId) {
        const cached = this.ctx.stores.getAll();
        if (cached.length > 0) {
          this.stores = cached;
          this.cdr.detectChanges();
        }
        this.apiService.getStores().subscribe({
          next: stores => {
            this.ctx.stores.seed(stores);
            this.stores = this.ctx.stores.getAll();
            this.cdr.detectChanges();
          },
          error: () => {
            if (this.stores.length === 0) this.cdr.detectChanges();
          }
        });
      } else {
        this.stores = [];
        this.selectedStoreId = null;
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.userSub.unsubscribe();
    this.storeNameSub.unsubscribe();
  }

  get selectedStore(): StoreDto | null {
    const store = this.stores.find(s => s.id === this.selectedStoreId) ?? null;
    if (!store?.logoUrl) return store;
    // If the URL was already cache-busted (e.g. by a recent upload), keep it as-is.
    // Otherwise append the session timestamp so the browser fetches the latest image.
    const logoUrl = store.logoUrl.includes('?t=') ? store.logoUrl : `${store.logoUrl}?t=${this.sessionTs}`;
    return { ...store, logoUrl };
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'Administrator';
  }

  get isStoreEmployee(): boolean {
    const r = this.currentUser?.role;
    return r === 'StoreEmployee' || r === 'StoreManager' || r === 'Administrator';
  }

  get headerTitle(): string {
    if (this.currentUser?.storeId) {
      return this.stores.find(s => s.id === this.currentUser!.storeId)?.storeName
        ?? 'Commander Tournament Organizer';
    }
    return 'Commander Tournament Organizer';
  }

  login(): void {
    this.authService.login();
  }

  logout(): void {
    this.authService.logout();
    this.storeContext.setSelectedStoreId(null);
    this.cdr.detectChanges();
  }
}
