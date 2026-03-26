import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Subject } from 'rxjs';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { StoreAnalyticsComponent } from './store-analytics.component';
import { ApiService } from '../../core/services/api.service';
import { StoreAnalyticsDto } from '../../core/models/api.models';

const emptyAnalytics: StoreAnalyticsDto = {
  eventTrends: [],
  topCommanders: [],
  topPlayers: [],
  finishDistribution: { first: 0, second: 0, third: 0, fourth: 0 },
  colorFrequency: [],
};

const fullAnalytics: StoreAnalyticsDto = {
  eventTrends: [
    { year: 2026, month: 1, eventCount: 3, avgPlayerCount: 6.5 },
    { year: 2026, month: 2, eventCount: 2, avgPlayerCount: 5.0 },
  ],
  topCommanders: [
    { commanderName: "Atraxa", wins: 5, gamesPlayed: 10, winPercent: 50 },
  ],
  topPlayers: [
    { playerId: 1, playerName: "Alice", totalPoints: 40, eventsPlayed: 3 },
  ],
  finishDistribution: { first: 25, second: 25, third: 25, fourth: 25 },
  colorFrequency: [{ colorCode: 'W', count: 8 }],
};

describe('StoreAnalyticsComponent', () => {
  let mockApi: { getStoreAnalytics: jest.Mock };

  beforeEach(() => {
    mockApi = { getStoreAnalytics: jest.fn().mockReturnValue(of(emptyAnalytics)) };
  });

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [StoreAnalyticsComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: ApiService, useValue: mockApi },
      ],
    }).compileComponents();
  }

  it('loading spinner shown while API call is pending', async () => {
    const subject = new Subject<StoreAnalyticsDto>();
    mockApi.getStoreAnalytics.mockReturnValue(subject.asObservable());
    await setup();
    const fixture = TestBed.createComponent(StoreAnalyticsComponent);
    fixture.componentInstance.storeId = 1;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('mat-spinner')).toBeTruthy();
  });

  it('event trends section rendered with correct month/count data', async () => {
    mockApi.getStoreAnalytics.mockReturnValue(of(fullAnalytics));
    await setup();
    const fixture = TestBed.createComponent(StoreAnalyticsComponent);
    fixture.componentInstance.storeId = 1;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h3')?.textContent).toContain('Event Trends');
    expect(compiled.textContent).toContain('3');  // event count for Jan
  });

  it('top commanders section rendered with win %', async () => {
    mockApi.getStoreAnalytics.mockReturnValue(of(fullAnalytics));
    await setup();
    const fixture = TestBed.createComponent(StoreAnalyticsComponent);
    fixture.componentInstance.storeId = 1;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Atraxa');
    expect(compiled.textContent).toContain('50');
  });

  it('empty state shown when data arrays are empty', async () => {
    mockApi.getStoreAnalytics.mockReturnValue(of(emptyAnalytics));
    await setup();
    const fixture = TestBed.createComponent(StoreAnalyticsComponent);
    fixture.componentInstance.storeId = 1;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const emptyMsgs = compiled.querySelectorAll('.empty-state');
    expect(emptyMsgs.length).toBeGreaterThan(0);
  });
});
