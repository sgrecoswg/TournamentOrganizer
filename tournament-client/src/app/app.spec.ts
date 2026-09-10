import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of, Subject, EMPTY } from 'rxjs';
import { App } from './app';
import { AuthService } from './core/services/auth.service';
import { ApiService } from './core/services/api.service';
import { StoreContextService } from './core/services/store-context.service';
import { LocalStorageContext } from './core/services/local-storage-context.service';
import { ThemeService } from './core/services/theme.service';
import { NetworkStatusService } from './core/services/network-status.service';
import { SwUpdate } from '@angular/service-worker';

describe('App — sidenav visibility', () => {
  let mockNetworkStatus: { degraded: boolean; degraded$: BehaviorSubject<boolean> };

  function setup(degraded: boolean) {
    mockNetworkStatus = {
      degraded,
      degraded$: new BehaviorSubject<boolean>(degraded),
    };

    const mockAuthService = {
      currentUser$: new Subject().asObservable(),
      authReady$:   new BehaviorSubject<boolean>(true).asObservable(),
      login:        jest.fn(),
      logout:       jest.fn(),
    };

    const mockStoreContext = {
      storesChanged$:   new Subject<void>().asObservable(),
      selectedStoreId:  null,
      setSelectedStoreId: jest.fn(),
    };

    const mockCtx = {
      stores: { getAll: jest.fn().mockReturnValue([]) },
      setActiveStore: jest.fn(),
    };

    return TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: AuthService,          useValue: mockAuthService },
        { provide: ApiService,           useValue: { getStores: jest.fn().mockReturnValue(EMPTY) } },
        { provide: StoreContextService,  useValue: mockStoreContext },
        { provide: LocalStorageContext,  useValue: mockCtx },
        { provide: ThemeService,         useValue: { resolveAndApply: jest.fn() } },
        { provide: SwUpdate,             useValue: { isEnabled: false, versionUpdates: EMPTY } },
        { provide: MatSnackBar,          useValue: { open: jest.fn() } },
        { provide: NetworkStatusService, useValue: mockNetworkStatus },
      ],
    }).compileComponents();
  }

  function linkTexts(fixture: any): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('a[mat-list-item]'))
      .map((a: any) => a.textContent.trim());
  }

  it('shows Home, Leaderboard, and Players when online', async () => {
    await setup(false);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const texts = linkTexts(fixture).join(' | ');
    expect(texts).toContain('Home');
    expect(texts).toContain('Leaderboard');
    expect(texts).toContain('Players');
  });

  it('hides Home and Leaderboard but keeps Players visible when degraded', async () => {
    await setup(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const texts = linkTexts(fixture).join(' | ');
    expect(texts).not.toContain('Home');
    expect(texts).not.toContain('Leaderboard');
    expect(texts).toContain('Players');
  });
});
