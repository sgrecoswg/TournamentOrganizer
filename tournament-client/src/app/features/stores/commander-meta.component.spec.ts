import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { CommanderMetaComponent } from './commander-meta.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CommanderMetaReportDto } from '../../core/models/api.models';

const makeReport = (overrides: Partial<CommanderMetaReportDto> = {}): CommanderMetaReportDto => ({
  storeId: 1,
  period: '30d',
  topCommanders: [],
  colorBreakdown: {},
  ...overrides,
});

describe('CommanderMetaComponent', () => {
  const STORE_ID = 1;

  let mockApi: { getCommanderMeta: jest.Mock };
  let mockAuth: { currentUser: null };

  async function setup(report: CommanderMetaReportDto = makeReport()) {
    mockApi  = { getCommanderMeta: jest.fn().mockReturnValue(of(report)) };
    mockAuth = { currentUser: null };

    await TestBed.configureTestingModule({
      imports: [CommanderMetaComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => String(STORE_ID) } } } },
        { provide: ApiService,     useValue: mockApi },
        { provide: AuthService,    useValue: mockAuth },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should create', async () => {
    await setup();
    const fixture = TestBed.createComponent(CommanderMetaComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('calls getCommanderMeta with storeId and default period on init', async () => {
    await setup();
    TestBed.createComponent(CommanderMetaComponent).detectChanges();
    expect(mockApi.getCommanderMeta).toHaveBeenCalledWith(STORE_ID, '30d');
  });

  it('renders commander rows when data is present', async () => {
    const report = makeReport({
      topCommanders: [{ commanderName: 'Atraxa', timesPlayed: 8, wins: 4, winRate: 50, avgFinish: 2.1 }],
    });
    await setup(report);
    const fixture = TestBed.createComponent(CommanderMetaComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Atraxa');
  });

  it('formats win rate to 1 decimal place', async () => {
    const report = makeReport({
      topCommanders: [{ commanderName: 'Atraxa', timesPlayed: 8, wins: 4, winRate: 50, avgFinish: 2.1 }],
    });
    await setup(report);
    const fixture = TestBed.createComponent(CommanderMetaComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('50.0%');
  });

  it('shows empty state when no commanders', async () => {
    await setup(makeReport({ topCommanders: [] }));
    const fixture = TestBed.createComponent(CommanderMetaComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No commander data');
  });

  it('calls getCommanderMeta with new period when period changes', async () => {
    await setup();
    const fixture = TestBed.createComponent(CommanderMetaComponent);
    fixture.detectChanges();
    fixture.componentInstance.period = '90d';
    fixture.componentInstance.loadMeta();
    expect(mockApi.getCommanderMeta).toHaveBeenCalledWith(STORE_ID, '90d');
  });
});
