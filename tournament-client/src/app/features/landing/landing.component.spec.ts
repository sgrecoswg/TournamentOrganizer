import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { LandingComponent } from './landing.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { makeEventDto, makeLeaderboardEntry } from '../../../../e2e/helpers/api-mock';

const mockApi = {
  getAllEvents: jest.fn().mockReturnValue(of([])),
  getLeaderboard: jest.fn().mockReturnValue(of([])),
};

function makeAuthService(isStoreEmployee: boolean) {
  return { isStoreEmployee };
}

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;
  let component: LandingComponent;

  function setup(isStoreEmployee = false, events = makeApi().events, leaderboard = makeApi().leaderboard) {
    mockApi.getAllEvents.mockReturnValue(of(events));
    mockApi.getLeaderboard.mockReturnValue(of(leaderboard));

    TestBed.configureTestingModule({
      imports: [LandingComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mockApi },
        { provide: AuthService, useValue: makeAuthService(isStoreEmployee) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "Find Events" heading', () => {
    setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h2')?.textContent).toContain('Find Events');
  });

  it('shows "Featured Events" subheading', () => {
    setup();
    const el: HTMLElement = fixture.nativeElement;
    const h3 = Array.from(el.querySelectorAll('h3')).find(h => h.textContent?.includes('Featured Events'));
    expect(h3).toBeTruthy();
  });

  it('renders a card for each Registration-status event', () => {
    const events = [
      makeEventDto({ id: 1, status: 'Registration' }),
      makeEventDto({ id: 2, status: 'Registration' }),
    ];
    setup(false, events);
    const cards = fixture.nativeElement.querySelectorAll('mat-card.event-card');
    expect(cards.length).toBe(2);
  });

  it('does NOT render InProgress events in featured list', () => {
    const events = [
      makeEventDto({ id: 1, status: 'Registration' }),
      makeEventDto({ id: 2, status: 'InProgress' }),
    ];
    setup(false, events);
    const cards = fixture.nativeElement.querySelectorAll('mat-card.event-card');
    expect(cards.length).toBe(1);
  });

  it('event card shows the event name', () => {
    const events = [makeEventDto({ id: 1, status: 'Registration', name: 'Grand Prix Test' })];
    setup(false, events);
    const card: HTMLElement = fixture.nativeElement.querySelector('mat-card.event-card');
    expect(card.querySelector('.event-name')?.textContent).toContain('Grand Prix Test');
  });

  it('event card links to /events/:id', () => {
    const events = [makeEventDto({ id: 42, status: 'Registration' })];
    setup(false, events);
    const cardDe = fixture.debugElement.query(By.css('mat-card.event-card'));
    const rl = cardDe.injector.get(RouterLink) as any;
    // Angular 15+ stores commands as a private field; check all own keys for the array containing 42
    const found = Object.keys(rl).some(k => {
      try { return JSON.stringify(rl[k])?.includes('42'); } catch { return false; }
    });
    expect(found).toBe(true);
  });

  it('shows "No upcoming events" when featured list is empty', () => {
    setup(false, []);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.empty-state')?.textContent).toContain('No upcoming events');
  });

  it('shows "Top Players" heading', () => {
    setup();
    const el: HTMLElement = fixture.nativeElement;
    const h2s = Array.from(el.querySelectorAll('h2'));
    expect(h2s.some(h => h.textContent?.includes('Top Players'))).toBe(true);
  });

  it('renders up to 5 leaderboard rows', () => {
    const entries = Array.from({ length: 7 }, (_, i) =>
      makeLeaderboardEntry({ rank: i + 1, playerId: i + 1 })
    );
    setup(false, [], entries);
    const rows = fixture.nativeElement.querySelectorAll('tr.leaderboard-row');
    expect(rows.length).toBe(5);
  });

  it('"View Full Leaderboard" link is present', () => {
    setup();
    const el: HTMLElement = fixture.nativeElement;
    const link = Array.from(el.querySelectorAll('a')).find(a => a.textContent?.includes('View Full Leaderboard'));
    expect(link).toBeTruthy();
  });

  it('"Host a Tournament" button is visible when isStoreEmployee = true', () => {
    setup(true);
    const el: HTMLElement = fixture.nativeElement;
    const btn = Array.from(el.querySelectorAll('button, a')).find(b => b.textContent?.trim().includes('Host a Tournament'));
    expect(btn).toBeTruthy();
  });

  it('"Host a Tournament" button is NOT visible when isStoreEmployee = false', () => {
    setup(false);
    const el: HTMLElement = fixture.nativeElement;
    const btn = Array.from(el.querySelectorAll('button, a')).find(b => b.textContent?.trim().includes('Host a Tournament'));
    expect(btn).toBeFalsy();
  });
});

function makeApi() {
  return { events: [] as ReturnType<typeof makeEventDto>[], leaderboard: [] as ReturnType<typeof makeLeaderboardEntry>[] };
}
