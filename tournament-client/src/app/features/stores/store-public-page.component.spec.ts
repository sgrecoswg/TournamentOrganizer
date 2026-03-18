import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { StorePublicPageComponent } from './store-public-page.component';
import { ApiService } from '../../core/services/api.service';
import { StorePublicDto, StoreEventSummaryDto, StorePublicTopPlayerDto } from '../../core/models/api.models';

describe('StorePublicPageComponent', () => {
  const makeEvent = (id: number, name: string): StoreEventSummaryDto => ({
    eventId: id, eventName: name, date: '2026-04-01T00:00:00Z', status: 'Registration'
  });

  const makePlayer = (id: number, name: string, score: number): StorePublicTopPlayerDto => ({
    playerId: id, name, conservativeScore: score, avatarUrl: null
  });

  const makeDto = (overrides: Partial<StorePublicDto> = {}): StorePublicDto => ({
    id: 1,
    storeName: 'Top Deck Games',
    slug: 'top-deck-games',
    location: '42 Card St, Portland OR',
    logoUrl: null,
    backgroundImageUrl: null,
    upcomingEvents: [],
    recentEvents: [],
    topPlayers: [],
    ...overrides,
  });

  const mockApi = {
    getStorePublicPage: jest.fn(),
  };

  const mockRoute = {
    snapshot: { paramMap: { get: jest.fn().mockReturnValue('top-deck-games') } },
  };

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [StorePublicPageComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: ApiService,     useValue: mockApi },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockApi.getStorePublicPage.mockReturnValue(of(makeDto()));
    await setup();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls getStorePublicPage with slug from route params', () => {
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    expect(mockApi.getStorePublicPage).toHaveBeenCalledWith('top-deck-games');
  });

  it('renders store name as heading', () => {
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Top Deck Games');
  });

  it('renders location when present', () => {
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('42 Card St, Portland OR');
  });

  it('renders store logo when logoUrl is set', () => {
    mockApi.getStorePublicPage.mockReturnValue(of(makeDto({ logoUrl: '/logos/1.png' })));
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    const img: HTMLImageElement | null = fixture.nativeElement.querySelector('img.store-logo');
    expect(img).not.toBeNull();
    expect(img!.src).toContain('/logos/1.png');
  });

  it('does not render logo img when logoUrl is null', () => {
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img.store-logo');
    expect(img).toBeNull();
  });

  it('shows upcoming events list', () => {
    mockApi.getStorePublicPage.mockReturnValue(of(makeDto({
      upcomingEvents: [makeEvent(1, 'FNM Draft'), makeEvent(2, 'Commander Night')],
    })));
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('FNM Draft');
    expect(el.textContent).toContain('Commander Night');
  });

  it('shows "No upcoming events" when list is empty', () => {
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No upcoming events');
  });

  it('shows recent events list', () => {
    mockApi.getStorePublicPage.mockReturnValue(of(makeDto({
      recentEvents: [makeEvent(10, 'Last Week Draft')],
    })));
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Last Week Draft');
  });

  it('shows top players list', () => {
    mockApi.getStorePublicPage.mockReturnValue(of(makeDto({
      topPlayers: [makePlayer(1, 'Alice', 20.5), makePlayer(2, 'Bob', 18.3)],
    })));
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Alice');
    expect(el.textContent).toContain('Bob');
  });

  it('shows "No ranked players yet" when topPlayers is empty', () => {
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No ranked players yet');
  });

  it('shows not-found message on 404 error', () => {
    mockApi.getStorePublicPage.mockReturnValue(throwError(() => ({ status: 404 })));
    const fixture = TestBed.createComponent(StorePublicPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Store not found');
  });

  // ── Background image ────────────────────────────────────────────────────────

  describe('Background image', () => {
    it('store-header has background-image style when backgroundImageUrl is set', () => {
      mockApi.getStorePublicPage.mockReturnValue(
        of(makeDto({ backgroundImageUrl: '/backgrounds/1.png' }))
      );
      const fixture = TestBed.createComponent(StorePublicPageComponent);
      fixture.detectChanges();
      const header: HTMLElement | null = fixture.nativeElement.querySelector('.store-header');
      expect(header).not.toBeNull();
      expect(header!.style.backgroundImage).toContain('/backgrounds/1.png');
    });

    it('store-header has no background-image style when backgroundImageUrl is null', () => {
      mockApi.getStorePublicPage.mockReturnValue(of(makeDto({ backgroundImageUrl: null })));
      const fixture = TestBed.createComponent(StorePublicPageComponent);
      fixture.detectChanges();
      const header: HTMLElement | null = fixture.nativeElement.querySelector('.store-header');
      expect(header).not.toBeNull();
      expect(header!.style.backgroundImage).toBeFalsy();
    });
  });
});
