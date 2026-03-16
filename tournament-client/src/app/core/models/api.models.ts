// Auth DTOs
export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: 'Player' | 'StoreEmployee' | 'StoreManager' | 'Administrator';
  playerId?: number;
  storeId?: number;
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
export interface StoreDto {
  id: number;
  storeName: string;
  isActive: boolean;
  logoUrl?: string | null;
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
}

export interface CreateStoreDto {
  storeName: string;
}

export interface UpdateStoreDto {
  storeName: string;
  allowableTradeDifferential: number;
  themeId?: number | null;
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
}

export interface CreateLicenseDto {
  appKey: string;
  availableDate: string;
  expiresDate: string;
}

export interface UpdateLicenseDto {
  appKey: string;
  isActive: boolean;
  availableDate: string;
  expiresDate: string;
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
