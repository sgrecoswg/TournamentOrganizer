// License Tier
export type LicenseTier = 'Free' | 'Tier1' | 'Tier2';

// Auth DTOs
export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: 'Player' | 'StoreEmployee' | 'StoreManager' | 'Administrator';
  playerId?: number;
  storeId?: number;
  licenseTier?: LicenseTier;
}

// Player DTOs
export interface CreatePlayerDto {
  name: string;
  email: string;
}

export interface UpdatePlayerDto {
  name: string;
  email: string;
  isActive: boolean;
}

export interface PlayerDto {
  id: number;
  name: string;
  email: string;
  mu: number;
  sigma: number;
  conservativeScore: number;
  isRanked: boolean;
  placementGamesLeft: number;
  isActive: boolean;
  avatarUrl?: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: number;
  name: string;
  conservativeScore: number;
  mu: number;
  sigma: number;
}

export interface PlayerProfile {
  id: number;
  name: string;
  email: string;
  mu: number;
  sigma: number;
  conservativeScore: number;
  isRanked: boolean;
  placementGamesLeft: number;
  isActive: boolean;
  gameHistory: PlayerGameHistory[];
  eventRegistrations: PlayerEventRegistration[];
  avatarUrl?: string | null;
  badges?: PlayerBadgeDto[];
}

export interface PlayerBadgeDto {
  badgeKey: string;
  displayName: string;
  awardedAt: string;
  eventId?: number | null;
}

export interface PlayerGameHistory {
  gameId: number;
  finishPosition: number;
  eliminations: number;
  turnsSurvived: number;
  commanderPlayed: string | null;
  deckColors: string | null;
  conceded: boolean;
  eventId: number;
  eventName: string;
  eventDate: string;
  roundNumber: number;
  podNumber: number;
}

export interface PlayerEventRegistration {
  eventId: number;
  eventName: string;
  eventDate: string;
  decklistUrl: string | null;
  commanders: string | null;
  storeName: string | null;
  art_crop : string | null;
}

export interface CommanderStatDto {
  commanderName: string;
  gamesPlayed: number;
  wins: number;
  avgFinish: number;
}

export interface PlayerCommanderStatsDto {
  playerId: number;
  commanders: CommanderStatDto[];
}

export interface RatingSnapshotDto {
  date: string;
  conservativeScore: number;
  eventName: string;
  roundNumber: number;
}

export interface RatingHistoryDto {
  playerId: number;
  history: RatingSnapshotDto[];
}

// Event DTOs
export type PointSystem = 'ScoreBased' | 'WinBased' | 'VictoryPoints' | 'PointWager' | 'SocialVoting' | 'FiveOneZero' | 'SeatBased';

export const POINT_SYSTEM_LABELS: Record<PointSystem, string> = {
  ScoreBased: 'Score-Based (1st=4, 2nd=3, 3rd=2, 4th=1)',
  WinBased: 'Win-Based (Win=5, Others=0)',
  VictoryPoints: 'Victory Points (coming soon)',
  PointWager: 'Point Wager (10% wager, winner takes all)',
  SocialVoting: 'Social Voting (coming soon)',
  FiveOneZero: '5-1-0 (Win=5, Loss=1, Draw=0; seat bonus +10)',
  SeatBased: 'Seat-Based (Win earns seat pts: seat1=7…seat4=10)',
};

export interface CreateEventDto {
  name: string;
  date: string;
  storeId?: number;
  defaultRoundTimeMinutes?: number;
  maxPlayers?: number | null;
  pointSystem?: PointSystem;
}

export interface EventDto {
  id: number;
  name: string;
  date: string;
  status: string;
  playerCount: number;
  defaultRoundTimeMinutes: number;
  maxPlayers: number | null;
  pointSystem: PointSystem;
  storeId?: number;
  storeName?: string;
  plannedRounds?: number | null;
  checkInToken?: string | null;
  backgroundImageUrl?: string | null;
  storeBackgroundImageUrl?: string | null;
}

export interface CheckInResponseDto {
  eventId: number;
  eventName: string;
}

export interface RegisterPlayerDto {
  playerId: number;
  decklistUrl?: string | null;
  commanders?: string | null;
}

export interface UpdateEventStatusDto {
  status: string;
  plannedRounds?: number;
}

export interface EventPlayerDto {
  playerId: number;
  name: string;
  conservativeScore: number;
  isRanked: boolean;
  decklistUrl: string | null;
  commanders: string | null;
  isDropped: boolean;
  isDisqualified: boolean;
  isCheckedIn: boolean;
  droppedAfterRound?: number | null;
  isWaitlisted?: boolean;
  waitlistPosition?: number | null;
}

// Game / Round DTOs
export interface GameResultSubmit {
  playerId: number;
  finishPosition: number;
  eliminations: number;
  turnsSurvived: number;
  commanderPlayed: string | null;
  deckColors: string | null;
  conceded: boolean;
}

export interface RoundDto {
  roundId: number;
  roundNumber: number;
  pods: PodDto[];
}

export interface PodDto {
  podId: number;
  podNumber: number;
  finishGroup: number | null;
  gameId: number;
  players: PodPlayer[];
  gameStatus: string;
  winnerPlayerId: number | null;
}

export interface PodPlayer {
  playerId: number;
  name: string;
  conservativeScore: number;
  seatOrder: number;
}

// Wishlist / For-Trade
export interface WishlistEntryDto {
  id: number;
  playerId: number;
  cardName: string;
  quantity: number;
  usdPrice: number | null;
}

export interface TradeEntryDto {
  id: number;
  playerId: number;
  cardName: string;
  quantity: number;
  usdPrice: number | null;
}

export interface CreateCardEntryDto {
  cardName: string;
  quantity: number;
}

export interface BulkUploadResultDto {
  added: number;
  errors: string[];
}

// Themes
export interface ThemeDto {
  id: number;
  name: string;
  cssClass: string;
  isActive: boolean;
}

// Stores
export interface StoreEventSummaryDto {
  eventId: number;
  eventName: string;
  date: string;
  status: string;
}

export interface StoreDto {
  id: number;
  storeName: string;
  isActive: boolean;
  logoUrl?: string | null;
  slug?: string | null;
  location?: string | null;
  backgroundImageUrl?: string | null;
  tier?: LicenseTier | null;
}

export interface StoreDetailDto {
  id: number;
  storeName: string;
  isActive: boolean;
  allowableTradeDifferential: number;
  license?: LicenseDto | null;
  themeId?: number | null;
  themeCssClass?: string | null;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  hasDiscordWebhook?: boolean;
  sellerPortalUrl?: string | null;
  slug?: string | null;
}

export interface StorePublicTopPlayerDto {
  playerId: number;
  name: string;
  conservativeScore: number;
  avatarUrl?: string | null;
}

export interface StorePublicDto {
  id: number;
  storeName: string;
  slug?: string | null;
  location?: string | null;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  upcomingEvents: StoreEventSummaryDto[];
  recentEvents: StoreEventSummaryDto[];
  topPlayers: StorePublicTopPlayerDto[];
}

export interface CreateStoreDto {
  storeName: string;
}

export interface UpdateStoreDto {
  storeName: string;
  allowableTradeDifferential: number;
  themeId?: number | null;
  discordWebhookUrl?: string | null;
  sellerPortalUrl?: string | null;
}

// Suggested Trades
export interface TradeLegDto {
  fromPlayerId: number;
  fromPlayerName: string;
  toPlayerId: number;
  toPlayerName: string;
  cardName: string;
  quantity: number;
  usdPrice: number | null;
}

export interface SuggestedTradeDto {
  type: string;
  participantIds: number[];
  participantNames: string[];
  legs: TradeLegDto[];
}

export interface TradeCardDemandDto {
  cardName: string;
  wishlistCount: number;
  totalPlayers: number;
  demandPercent: number;
  interestedPlayerNames: string[];
}

export interface WishlistCardSupplyDto {
  cardName: string;
  sellerPlayerNames: string[];
}

// User / Employee management
export interface AppUserDto {
  id: number;
  email: string;
  name: string;
  role: string;
  playerId?: number;
  storeId?: number;
}

export interface AssignEmployeeDto {
  email: string;
  name: string;
  role: 'StoreEmployee' | 'StoreManager';
}

// Licensing
export interface LicenseDto {
  id: number;
  storeId: number;
  appKey: string;
  isActive: boolean;
  availableDate: string;
  expiresDate: string;
  tier: LicenseTier;
  isInTrial?: boolean;
  trialExpiresDate?: string | null;
  gracePeriodDays?: number;
}

export interface StoreTierDto {
  storeId: number;
  tier: LicenseTier;
  isActive: boolean;
  expiresDate: string | null;
  isInTrial?: boolean;
  trialExpiresDate?: string | null;
  isInGracePeriod?: boolean;
  gracePeriodEndsDate?: string | null;
}

export interface CreateLicenseDto {
  appKey: string;
  availableDate: string;
  expiresDate: string;
  tier?: LicenseTier;
  trialExpiresDate?: string | null;
  gracePeriodDays?: number;
}

export interface UpdateLicenseDto {
  appKey: string;
  isActive: boolean;
  availableDate: string;
  expiresDate: string;
  tier?: LicenseTier;
  trialExpiresDate?: string | null;
  gracePeriodDays?: number;
}

// Commander Meta Report
export interface CommanderMetaEntryDto {
  commanderName: string;
  timesPlayed: number;
  wins: number;
  winRate: number;
  avgFinish: number;
}

export interface CommanderMetaReportDto {
  storeId: number;
  period: string;
  topCommanders: CommanderMetaEntryDto[];
  colorBreakdown: Record<string, number>;
}

// LocalStorage / Sync types

/** Change state tracked per record by LocalTable<T>. */
export type ChangeState = 'added' | 'modified' | 'deleted';

/** Pending changes returned by LocalTable.getPending(). */
export interface ChangeSet<T> {
  added: T[];
  modified: T[];
  deleted: T[];
}

/** Summary returned after a SyncService push. */
export interface SyncResult {
  pushed: number;
  conflicts: number;
  errors: number;
}

/** Full export payload written to / read from JSON. */
export interface ExportData {
  storeId:     number;
  exportedAt:  string;
  players:     PlayerDto[];
  stores:      StoreDto[];
  events:      EventDto[];
  rounds:      RoundDto[];
  pods:        PodDto[];
  gameResults: LocalGameResultDto[];
}

/** Result of parsing and validating an import file. */
export interface ImportValidation {
  status: 'ok' | 'storeIdMismatch' | 'parseError' | 'invalidFormat';
  /** Parsed data — present when status is 'ok' or 'storeIdMismatch'. */
  data?: ExportData;
  /** The storeId stored in the file (useful when status is 'storeIdMismatch'). */
  fileStoreId?: number;
  error?: string;
}

/**
 * Game result stored in LocalStorageContext.
 * Extends GameResultSubmit with a local id and the owning gameId
 * so records can be tracked individually.
 */
export interface LocalGameResultDto {
  id: number;
  gameId: number;
  playerId: number;
  finishPosition: number;
  eliminations: number;
  turnsSurvived: number;
  commanderPlayed: string | null;
  deckColors: string | null;
  conceded: boolean;
}

// Pairings
export interface PodPlayerPairingsDto {
  playerId: number;
  name: string;
  commanderName: string | null;
  seatOrder: number;
}

export interface PodPairingsDto {
  podId: number;
  podNumber: number;
  players: PodPlayerPairingsDto[];
  gameStatus: string;
  winnerPlayerId: number | null;
}

export interface PairingsDto {
  eventId: number;
  eventName: string;
  currentRound: number | null;
  pods: PodPairingsDto[];
  backgroundImageUrl?: string | null;
}

// Standings
export interface StandingsEntry {
  rank: number;
  playerId: number;
  playerName: string;
  totalPoints: number;
  tiebreaker: number;
  finishPositions: number[];
  gameResults: string[];
}

// ── Scryfall ───────────────────────────────────────────────────────────────────

export interface ScryfallCardImageUris {
  normal: string;
  large: string;
  art_crop : string;
}

export interface ScryfallCard {
  name: string;
  image_uris?: ScryfallCardImageUris;
  card_faces?: Array<{ image_uris?: ScryfallCardImageUris }>;
  prices: {
    usd: string | null;
    usd_foil: string | null;
  };
  purchase_uris: {
    tcgplayer?: string;
    cardkingdom?: string;
    cardmarket?: string;
  };
}

// ── Bulk Register ──────────────────────────────────────────────────────────────

/** Frontend-only: resolved player from local cache */
export interface BulkRegisterFoundDto  { playerId: number; name: string; email: string; }

/** Frontend-only: preview data built client-side before any API call */
export interface BulkRegisterPreviewDto {
  found:             BulkRegisterFoundDto[];
  notFound:          string[];
  alreadyRegistered: BulkRegisterFoundDto[];
}

/** Sent to POST /api/events/{id}/bulkregister/confirm */
export interface BulkRegisterConfirmItemDto { playerId?: number | null; email: string; name?: string | null; }
export interface BulkRegisterConfirmDto    { registrations: BulkRegisterConfirmItemDto[]; }

/** Response from POST /api/events/{id}/bulkregister/confirm */
export interface BulkRegisterResultDto     { registered: number; created: number; errors: { email: string; reason: string }[]; }

// ── Event Templates ────────────────────────────────────────────────────────────

export interface EventTemplateDto {
  id: number;
  storeId: number;
  name: string;
  description?: string | null;
  format: string;
  maxPlayers: number;
  numberOfRounds: number;
}

export interface CreateEventTemplateDto {
  name: string;
  description?: string | null;
  format: string;
  maxPlayers: number;
  numberOfRounds: number;
}


