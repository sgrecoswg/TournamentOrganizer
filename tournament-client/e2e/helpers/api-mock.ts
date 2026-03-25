import { Page } from '@playwright/test';
import { BulkRegisterResultDto, CheckInResponseDto, CommanderMetaEntryDto, CommanderMetaReportDto, CommanderStatDto, EventDto, EventPlayerDto, EventTemplateDto, LeaderboardEntry, LicenseDto, PairingsDto, PlayerBadgeDto, PlayerCommanderStatsDto, PlayerDto, PlayerProfile, RatingHistoryDto, RatingSnapshotDto, StoreDto, StoreDetailDto, StoreEventSummaryDto, StoreGroupDto, StorePublicDto, StorePublicTopPlayerDto, ThemeDto } from '../../src/app/core/models/api.models';

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

/** Intercept POST /api/events/:id/background and return the given event dto. */
export async function mockUploadEventBackground(page: Page, eventId: number, response: EventDto): Promise<void> {
  await page.route(`**/api/events/${eventId}/background`, route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
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
    badges:             [],
    ...overrides,
  };
}

export function makePlayerBadgeDto(overrides: Partial<PlayerBadgeDto> = {}): PlayerBadgeDto {
  return {
    badgeKey:    'first_win',
    displayName: 'First Win',
    awardedAt:   '2026-01-01T00:00:00Z',
    eventId:     null,
    ...overrides,
  };
}

/** Intercept GET /api/players/:id/badges and return the given list. */
export async function mockGetPlayerBadges(page: Page, playerId: number, badges: PlayerBadgeDto[]): Promise<void> {
  await page.route(`**/api/players/${playerId}/badges`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: badges });
    } else {
      route.continue();
    }
  });
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

// ── License ────────────────────────────────────────────────────────────────────

export function makeLicenseDto(overrides: Partial<LicenseDto> = {}): LicenseDto {
  return {
    id:            1,
    storeId:       1,
    appKey:        'TEST-KEY-1234',
    isActive:      true,
    availableDate: '2026-01-01T00:00:00Z',
    expiresDate:   '2027-01-01T00:00:00Z',
    tier:          'Tier2',
    ...overrides,
  };
}

// ── Event Templates ────────────────────────────────────────────────────────────

export async function mockGetEventTemplates(page: Page, storeId: number, templates: EventTemplateDto[]): Promise<void> {
  await page.route(`**/api/stores/${storeId}/eventtemplates`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: templates });
    } else {
      route.continue();
    }
  });
}

export async function mockCreateEventTemplate(page: Page, storeId: number, response: EventTemplateDto): Promise<void> {
  await page.route(`**/api/stores/${storeId}/eventtemplates`, route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 201, json: response });
    } else {
      route.continue();
    }
  });
}

export async function mockDeleteEventTemplate(page: Page, storeId: number, id: number): Promise<void> {
  await page.route(`**/api/stores/${storeId}/eventtemplates/${id}`, route => {
    if (route.request().method() === 'DELETE') {
      route.fulfill({ json: { message: 'Template deleted' } });
    } else {
      route.continue();
    }
  });
}

export function makeEventTemplateDto(overrides: Partial<EventTemplateDto> = {}): EventTemplateDto {
  return {
    id:             1,
    storeId:        1,
    name:           'Friday Night Commander',
    description:    null,
    format:         'Commander',
    maxPlayers:     16,
    numberOfRounds: 4,
    ...overrides,
  };
}

// ── Store Public Page ──────────────────────────────────────────────────────────

/** Intercept GET /api/stores/public/:slug and return the given page dto. */
export async function mockGetStorePublicPage(page: Page, slug: string, response: StorePublicDto): Promise<void> {
  await page.route(`**/api/stores/public/${slug}`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

/** Mock GET /api/stores/public/:slug to return a 404. */
export async function mockGetStorePublicPageNotFound(page: Page, slug: string): Promise<void> {
  await page.route(`**/api/stores/public/${slug}`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 404, json: { error: 'Not found' } });
    } else {
      route.continue();
    }
  });
}

export function makeStorePublicDto(overrides: Partial<StorePublicDto> = {}): StorePublicDto {
  return {
    id:                 1,
    storeName:          'Top Deck Games',
    slug:               'top-deck-games',
    location:           null,
    logoUrl:            null,
    backgroundImageUrl: null,
    upcomingEvents:     [],
    recentEvents:       [],
    topPlayers:         [],
    ...overrides,
  };
}

/** Intercept POST /api/stores/:id/background and return the given store dto. */
export async function mockUploadStoreBackground(page: Page, storeId: number, response: StoreDto): Promise<void> {
  await page.route(`**/api/stores/${storeId}/background`, route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

export function makeStoreEventSummaryDto(overrides: Partial<StoreEventSummaryDto> = {}): StoreEventSummaryDto {
  return {
    eventId:   1,
    eventName: 'Friday Night Commander',
    date:      '2026-04-01T00:00:00Z',
    status:    'Registration',
    ...overrides,
  };
}

export function makeStorePublicTopPlayerDto(overrides: Partial<StorePublicTopPlayerDto> = {}): StorePublicTopPlayerDto {
  return {
    playerId:          1,
    name:              'Alice',
    conservativeScore: 18.5,
    avatarUrl:         null,
    ...overrides,
  };
}

// ── Store Groups ───────────────────────────────────────────────────────────────

/** Intercept GET /api/storegroups and return the given list. */
export async function mockGetStoreGroups(page: Page, groups: StoreGroupDto[]): Promise<void> {
  await page.route('**/api/storegroups', route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: groups });
    } else {
      route.fallback();
    }
  });
}

/** Intercept POST /api/storegroups and return the given group. */
export async function mockCreateStoreGroup(page: Page, response: StoreGroupDto): Promise<void> {
  await page.route('**/api/storegroups', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 201, json: response });
    } else {
      route.fallback();
    }
  });
}

/** Intercept POST /api/storegroups/:groupId/stores/:storeId → 204 */
export async function mockAssignStore(page: Page, groupId: number, storeId: number): Promise<void> {
  await page.route(`**/api/storegroups/${groupId}/stores/${storeId}`, route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 204 });
    } else {
      route.continue();
    }
  });
}

export function makeStoreGroupDto(overrides: Partial<StoreGroupDto> = {}): StoreGroupDto {
  return {
    id:         1,
    name:       'Top Deck Chain',
    logoUrl:    null,
    storeCount: 0,
    ...overrides,
  };
}

/** Intercept GET https://api.scryfall.com/cards/autocomplete and return the given suggestions. */
export async function mockScryfallAutocomplete(page: Page, suggestions: string[]): Promise<void> {
  await page.route('https://api.scryfall.com/cards/autocomplete**', route => {
    route.fulfill({ json: { object: 'catalog', data: suggestions } });
  });
}

export function makeRatingSnapshotDto(overrides: Partial<RatingSnapshotDto> = {}): RatingSnapshotDto {
  return {
    date:              '2024-01-01T00:00:00',
    conservativeScore: 5.0,
    eventName:         'Test Event',
    roundNumber:       1,
    ...overrides,
  };
}

/** Intercept GET /api/players/:id/ratinghistory and return the given response. */
export async function mockGetRatingHistory(page: Page, playerId: number, response: RatingHistoryDto): Promise<void> {
  await page.route(`**/api/players/${playerId}/ratinghistory`, route => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: response });
    } else {
      route.continue();
    }
  });
}

/**
 * Stub all player-profile sub-resource endpoints (wishlist, trades, commander stats, etc.)
 * with empty arrays so that mat-table data sources receive valid iterables.
 * Register this AFTER stubUnmatchedApi so it takes priority (Playwright LIFO route order).
 */
export async function mockPlayerProfileSubApis(page: Page, playerId: number): Promise<void> {
  await page.route(`**/api/players/${playerId}/commanderstats`, route =>
    route.fulfill({ json: { playerId, commanders: [] } }));
  await page.route(`**/api/players/${playerId}/wishlist/supply`, route =>
    route.fulfill({ json: [] }));
  await page.route(`**/api/players/${playerId}/wishlist`, route => {
    if (route.request().method() === 'GET') route.fulfill({ json: [] });
    else route.continue();
  });
  await page.route(`**/api/players/${playerId}/trades/suggestions`, route =>
    route.fulfill({ json: [] }));
  await page.route(`**/api/players/${playerId}/trades/demand`, route =>
    route.fulfill({ json: [] }));
  await page.route(`**/api/players/${playerId}/trades`, route => {
    if (route.request().method() === 'GET') route.fulfill({ json: [] });
    else route.continue();
  });
  await page.route(`**/api/players/${playerId}/ratinghistory`, route =>
    route.fulfill({ json: { playerId, history: [] } }));
}
