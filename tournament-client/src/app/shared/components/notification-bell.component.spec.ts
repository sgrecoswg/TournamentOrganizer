import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NotificationBellComponent } from './notification-bell.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CurrentUser, NotificationCountDto, NotificationDto } from '../../core/models/api.models';

const MOCK_USER: CurrentUser = {
  id: 1,
  email: 'player@test.com',
  name: 'Test Player',
  role: 'Player',
  playerId: 1,
  storeId: null,
  licenseTier: 'Tier2',
};

function makeNotification(overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: 1,
    type: 'TradeMatch',
    message: 'New trade match found!',
    linkPath: '/players/2/profile#trades',
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('NotificationBellComponent', () => {
  let mockApiService: {
    getNotificationCount: jest.Mock;
    getNotifications: jest.Mock;
    markNotificationRead: jest.Mock;
    markAllNotificationsRead: jest.Mock;
  };
  let mockAuthService: { currentUser: CurrentUser | null; isTier2: boolean };

  function setup(user: CurrentUser | null = MOCK_USER, isTier2 = true) {
    mockApiService = {
      getNotificationCount: jest.fn().mockReturnValue(of({ unread: 0 } as NotificationCountDto)),
      getNotifications: jest.fn().mockReturnValue(of([])),
      markNotificationRead: jest.fn().mockReturnValue(of(undefined)),
      markAllNotificationsRead: jest.fn().mockReturnValue(of(undefined)),
    };
    mockAuthService = { currentUser: user, isTier2 };

    return TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('bell hidden when not logged in', async () => {
    await setup(null, false);
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[mat-icon-button]');
    expect(button).toBeNull();
  });

  it('bell hidden when isTier2 = false', async () => {
    await setup(MOCK_USER, false);
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[mat-icon-button]');
    expect(button).toBeNull();
  });

  it('unread count badge shown when unreadCount > 0', async () => {
    mockApiService = {
      getNotificationCount: jest.fn().mockReturnValue(of({ unread: 5 } as NotificationCountDto)),
      getNotifications: jest.fn().mockReturnValue(of([])),
      markNotificationRead: jest.fn().mockReturnValue(of(undefined)),
      markAllNotificationsRead: jest.fn().mockReturnValue(of(undefined)),
    };
    mockAuthService = { currentUser: MOCK_USER, isTier2: true };

    await TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.unreadCount).toBe(5);
  });

  it('clicking bell loads notifications', async () => {
    const notif = makeNotification();
    mockApiService = {
      getNotificationCount: jest.fn().mockReturnValue(of({ unread: 1 } as NotificationCountDto)),
      getNotifications: jest.fn().mockReturnValue(of([notif])),
      markNotificationRead: jest.fn().mockReturnValue(of(undefined)),
      markAllNotificationsRead: jest.fn().mockReturnValue(of(undefined)),
    };
    mockAuthService = { currentUser: MOCK_USER, isTier2: true };

    await TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        provideAnimationsAsync(),
        provideRouter([]),
        { provide: ApiService, useValue: mockApiService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();

    fixture.componentInstance.loadNotifications();
    fixture.detectChanges();

    expect(mockApiService.getNotifications).toHaveBeenCalled();
    expect(fixture.componentInstance.notifications).toHaveLength(1);
  });

  it('markAllRead calls apiService.markAllNotificationsRead', async () => {
    await setup(MOCK_USER, true);
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();

    fixture.componentInstance.markAllRead();
    fixture.detectChanges();

    expect(mockApiService.markAllNotificationsRead).toHaveBeenCalled();
  });
});
