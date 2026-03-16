import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { QrCheckinComponent } from './qr-checkin.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CheckInResponseDto } from '../../core/models/api.models';

const makeCheckInResponse = (overrides: Partial<CheckInResponseDto> = {}): CheckInResponseDto => ({
  eventId: 1,
  eventName: 'Friday Night Magic',
  ...overrides,
});

// ── Logged-in suite ────────────────────────────────────────────────────────

describe('QrCheckinComponent (logged in)', () => {
  let mockApiService: { checkInByToken: jest.Mock };

  beforeEach(async () => {
    mockApiService = { checkInByToken: jest.fn().mockReturnValue(of(makeCheckInResponse())) };

    await TestBed.configureTestingModule({
      imports: [QrCheckinComponent],
      providers: [
        provideRouter([{ path: '**', component: QrCheckinComponent }]),
        provideAnimationsAsync(),
        { provide: ApiService, useValue: mockApiService },
        { provide: AuthService, useValue: { currentUser: { id: 1, email: 'alice@test.com', role: 'Player' } } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'abc123' } } } },
      ],
    }).compileComponents();
  });

  it('calls checkInByToken on init and shows success message', () => {
    const fixture = TestBed.createComponent(QrCheckinComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(mockApiService.checkInByToken).toHaveBeenCalledWith('abc123');
    expect(el.querySelector('.checkin-success')).toBeTruthy();
    expect(el.querySelector('.checkin-error')).toBeFalsy();
    expect(el.querySelector('.checkin-success')?.textContent).toContain('Friday Night Magic');
  });

  it('shows error message on 404 response', () => {
    mockApiService.checkInByToken.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 }))
    );
    const fixture = TestBed.createComponent(QrCheckinComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.checkin-error')).toBeTruthy();
    expect(el.querySelector('.checkin-success')).toBeFalsy();
  });

  it('shows error message on 400 response', () => {
    mockApiService.checkInByToken.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400 }))
    );
    const fixture = TestBed.createComponent(QrCheckinComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.checkin-error')).toBeTruthy();
  });
});

// ── Not logged in suite ────────────────────────────────────────────────────

describe('QrCheckinComponent (not logged in)', () => {
  let mockApiService: { checkInByToken: jest.Mock };

  beforeEach(async () => {
    mockApiService = { checkInByToken: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [QrCheckinComponent],
      providers: [
        provideRouter([{ path: '**', component: QrCheckinComponent }]),
        provideAnimationsAsync(),
        { provide: ApiService, useValue: mockApiService },
        { provide: AuthService, useValue: { currentUser: null } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'abc123' } } } },
      ],
    }).compileComponents();
  });

  it('redirects to login and does not call API when not authenticated', () => {
    const fixture = TestBed.createComponent(QrCheckinComponent);
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate');
    fixture.detectChanges();

    expect(mockApiService.checkInByToken).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
