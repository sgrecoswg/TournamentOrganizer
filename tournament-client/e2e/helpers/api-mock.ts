import { Page } from '@playwright/test';
import { BulkRegisterResultDto, CheckInResponseDto, CommanderMetaEntryDto, CommanderMetaReportDto, CommanderStatDto, EventDto, EventPlayerDto, LeaderboardEntry, PairingsDto, PlayerCommanderStatsDto, PlayerDto, PlayerProfile, StoreDto, StoreDetailDto, ThemeDto } from '../../src/app/core/models/api.models';

/** Intercept GET /api/events and return the given list. */
export async function mockGetEvents(page: Page, events: EventDto[]): Promise<void> {
  await page.route('**/api/events', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: events });
    } else {
      route.continue();
    }
  });
}

/** Intercept GET /api/stores and return the given list. */
export async function mockGetStores(page: Page, stores: StoreDto[]): Promise<void> {
  await page.route('**/api/stores', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: stores });
    } else {
      route.continue();
    }
  });
}

/** Intercept GET /api/stores/:id and return the given store detail. */
export async function mockGetStore(page: Page, store: StoreDetailDto): Promise<void> {
  await page.route(`**/api/stores/${store.id}`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: store });
    } else {
      route.continue();
    }
  });
}

/** Intercept GET /api/stores/:id/employees and return the given list. */
export async function mockGetEmployees(page: Page, storeId: number, employees: unknown[]): Promise<void> {
  await page.route(`**/api/stores/${storeId}/employees`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: employees });
    } else {
      route.continue();
    }
  });
}

/**
 * Catch-all: fulfill any unmatched /api/* requests with an empty 200.
 *
 * ⚠️  MUST be registered BEFORE specific mocks in each test/beforeEach.
 * Playwright evaluates routes in LIFO order (last registered = first evaluated),
 * so routes registered after this one will take priority over it.
 */
export async function stubUnmatchedApi(page: Page): Promise<void> {
  await page.route('**/api/**', route => route.fulfill({ status: 200, json: {} }));
}

// ── Fixture builders ──────────────────────────────────────────────────────────

export function makeEventDto(overrides: Partial<EventDto> = {}): EventDto {
  return {
    id:                     1,
    name:                   'Test Event',
    date:                   '2026-03-15',
    status:                 'Registration',
    playerCount:            0,
    defaultRoundTimeMinutes: 55,
    maxPlayers:             null,
    pointSystem:            'ScoreBased',
    ...overrides,
  };
}

/** Intercept GET /api/players and return the given list. */
export async function mockGetPlayers(page: Page, players: PlayerDto[]): Promise<void> {
  await page.route('**/api/players', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: players });
    } else {
      route.continue();
    }
  });
}

export function makePlayerDto(overrides: Partial<PlayerDto> = {}): PlayerDto {
  return {
    id:                  1,
    name:                'Test Player',
    email:               'test@example.com',
    mu:                  25,
    sigma:               8.333,
    conservativeScore:   0,
    isRanked:            false,
    placementGamesLeft:  5,
    isActive:            true,
    ...overrides,
  };
}

export function makeStoreDto(overrides: Partial<StoreDto> = {}): StoreDto {
  return {
    id:       1,
    storeName: 'Test Game Shop',
    isActive:  true,
    ...overrides,
  };
}

export function makeStoreDetailDto(overrides: Partial<StoreDetailDto> = {}): StoreDetailDto {
  return {
    id:                       1,
    storeName:                'Test Game Shop',
    isActive:                 true,
    allowableTradeDifferential: 10,
    license:                  null,
    themeId:                  null,
    themeCssClass:            null,
    ...overrides,
  };
}

/** Intercept POST /api/stores/:id/logo and return the given store dto. */
export async function mockUploadStoreLogo(page: Page, storeId: number, response: StoreDto): Promise<void> {
  await page.route(`**/api/stores/${storeId}/logo`, route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

/** Intercept GET /api/themes and return the given list. */
export async function mockGetThemes(page: Page, themes: ThemeDto[]): Promise<void> {
  await page.route('**/api/themes', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: themes });
    } else {
      route.continue();
    }
  });
}

export function makeThemeDto(overrides: Partial<ThemeDto> = {}): ThemeDto {
  return {
    id:       1,
    name:     'Default',
    cssClass: 'theme-default',
    isActive: true,
    ...overrides,
  };
}

/** Intercept GET /api/players/:id/profile and return the given profile. */
export async function mockGetPlayerProfile(page: Page, profile: PlayerProfile): Promise<void> {
  await page.route(`**/api/players/${profile.id}/profile`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: profile });
    } else {
      route.continue();
    }
  });
}

export function makePlayerProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    id:                 1,
    name:               'Alice',
    email:              'alice@test.com',
    mu:                 25,
    sigma:              8.333,
    conservativeScore:  0,
    isRanked:           false,
    placementGamesLeft: 5,
    isActive:           true,
    gameHistory:        [],
    eventRegistrations: [],
    ...overrides,
  };
}

/** Intercept GET /api/leaderboard and return the given list. */
export async function mockGetLeaderboard(page: Page, entries: LeaderboardEntry[]): Promise<void> {
  await page.route('**/api/leaderboard', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: entries });
    } else {
      route.continue();
    }
  });
}

/** Intercept GET /api/events/:id and return the given event. */
export async function mockGetEvent(page: Page, event: EventDto): Promise<void> {
  await page.route(`**/api/events/${event.id}`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: event });
    } else {
      route.continue();
    }
  });
}

/** Intercept GET /api/events/:id/players and return the given list. */
export async function mockGetEventPlayers(page: Page, eventId: number, players: EventPlayerDto[]): Promise<void> {
  await page.route(`**/api/events/${eventId}/players`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: players });
    } else {
      route.continue();
    }
  });
}

/** Intercept PUT /api/events/:eventId/players/:playerId/checkin and return the given player. */
export async function mockSetCheckIn(page: Page, eventId: number, playerId: number, response: EventPlayerDto): Promise<void> {
  await page.route(`**/api/events/${eventId}/players/${playerId}/checkin`, route => {
    if (route.request().method() === 'PUT') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

export async function mockDropPlayer(page: Page, eventId: number, playerId: number): Promise<void> {
  await page.route(`**/api/events/${eventId}/players/${playerId}`, route => {
    if (route.request().method() === 'DELETE') {
      route.fulfill({ status: 204 });
    } else {
      route.continue();
    }
  });
}

/** Intercept PUT /api/events/:eventId/players/:playerId/drop and return the updated player. */
export async function mockSetPlayerDropped(
  page: Page, eventId: number, playerId: number, response: EventPlayerDto
): Promise<void> {
  await page.route(`**/api/events/${eventId}/players/${playerId}/drop`, route => {
    if (route.request().method() === 'PUT') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

export function makeEventPlayerDto(overrides: Partial<EventPlayerDto> = {}): EventPlayerDto {
  return {
    playerId:         1,
    name:             'Test Player',
    conservativeScore: 0,
    isRanked:         false,
    decklistUrl:      null,
    commanders:       null,
    isDropped:        false,
    isDisqualified:   false,
    isCheckedIn:      false,
    ...overrides,
  };
}

export function makeLeaderboardEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    rank:              1,
    playerId:          1,
    name:              'Test Player',
    conservativeScore: 0,
    mu:                25,
    sigma:             8.333,
    ...overrides,
  };
}

/** Intercept PUT /api/events/:eventId/players/:playerId/commander and return the updated player. */
export async function mockDeclareCommander(
  page: Page, eventId: number, playerId: number, response: EventPlayerDto
): Promise<void> {
  await page.route(`**/api/events/${eventId}/players/${playerId}/commander`, route => {
    if (route.request().method() === 'PUT') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

/** Intercept POST /api/events/:eventId/players/:playerId/promote and return the updated player. */
export async function mockPromoteFromWaitlist(
  page: Page, eventId: number, playerId: number, response: EventPlayerDto
): Promise<void> {
  await page.route(`**/api/events/${eventId}/players/${playerId}/promote`, route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

/** Intercept GET /api/events/:id/pairings and return the given pairings. */
export async function mockGetEventPairings(page: Page, eventId: number, response: PairingsDto): Promise<void> {
  await page.route(`**/api/events/${eventId}/pairings`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

/** Intercept POST /api/events/checkin/:token — pass a CheckInResponseDto or an HTTP error status. */
export async function mockCheckInByToken(
  page: Page,
  token: string,
  response: CheckInResponseDto | number
): Promise<void> {
  await page.route(`**/api/events/checkin/${token}`, route => {
    if (route.request().method() === 'POST') {
      if (typeof response === 'number') {
        route.fulfill({ status: response, json: { error: 'mock error' } });
      } else {
        route.fulfill({ json: response });
      }
    } else {
      route.continue();
    }
  });
}

export function makeCheckInResponseDto(overrides: Partial<CheckInResponseDto> = {}): CheckInResponseDto {
  return { eventId: 1, eventName: 'Friday Night Magic', ...overrides };
}

export function makeCommanderStatDto(overrides: Partial<CommanderStatDto> = {}): CommanderStatDto {
  return { commanderName: 'Atraxa', gamesPlayed: 5, wins: 3, avgFinish: 1.8, ...overrides };
}

export async function mockGetCommanderStats(
  page: Page, playerId: number, response: PlayerCommanderStatsDto
): Promise<void> {
  await page.route(`**/api/players/${playerId}/commanderstats`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

export function makeCommanderMetaEntryDto(overrides: Partial<CommanderMetaEntryDto> = {}): CommanderMetaEntryDto {
  return { commanderName: 'Atraxa', timesPlayed: 8, wins: 4, winRate: 50, avgFinish: 2.1, ...overrides };
}

export function makeCommanderMetaReportDto(overrides: Partial<CommanderMetaReportDto> = {}): CommanderMetaReportDto {
  return { storeId: 1, period: '30d', topCommanders: [], colorBreakdown: {}, ...overrides };
}

export async function mockGetCommanderMeta(
  page: Page, storeId: number, period: string, response: CommanderMetaReportDto
): Promise<void> {
  await page.route(`**/api/stores/${storeId}/meta?period=${period}`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

/** Intercept POST /api/players/:id/avatar → returns PlayerDto */
export async function mockUploadPlayerAvatar(page: Page, playerId: number, response: PlayerDto): Promise<void> {
  await page.route(`**/api/players/${playerId}/avatar`, route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

/** Intercept DELETE /api/players/:id/avatar → returns PlayerDto */
export async function mockRemovePlayerAvatar(page: Page, playerId: number, response: PlayerDto): Promise<void> {
  await page.route(`**/api/players/${playerId}/avatar`, route => {
    if (route.request().method() === 'DELETE') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

/** Intercept POST /api/stores/:id/discord/test → 204 */
export async function mockTestDiscordWebhook(page: Page, storeId: number): Promise<void> {
  await page.route(`**/api/stores/${storeId}/discord/test`, route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 204 });
    } else {
      route.continue();
    }
  });
}

export function makePairingsDto(overrides: Partial<PairingsDto> = {}): PairingsDto {
  return {
    eventId:      1,
    eventName:    'Friday Night Magic',
    currentRound: 1,
    pods: [
      {
        podId:          10,
        podNumber:      1,
        gameStatus:     'Pending',
        winnerPlayerId: null,
        players: [
          { playerId: 1, name: 'Alice', commanderName: 'Atraxa', seatOrder: 1 },
          { playerId: 2, name: 'Bob',   commanderName: null,     seatOrder: 2 },
          { playerId: 3, name: 'Carol', commanderName: null,     seatOrder: 3 },
          { playerId: 4, name: 'Dave',  commanderName: null,     seatOrder: 4 },
        ],
      },
    ],
    ...overrides,
  };
}

/** Intercept POST /api/events/:id/bulkregister/confirm and return the given result. */
export async function mockBulkRegisterConfirm(page: Page, eventId: number, response: BulkRegisterResultDto): Promise<void> {
  await page.route(`**/api/events/${eventId}/bulkregister/confirm`, route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

export function makeBulkRegisterResultDto(overrides: Partial<BulkRegisterResultDto> = {}): BulkRegisterResultDto {
  return {
    registered: 0,
    created: 0,
    errors: [],
    ...overrides,
  };
}
