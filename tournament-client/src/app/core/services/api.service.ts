import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreatePlayerDto, UpdatePlayerDto, PlayerDto, PlayerProfile, PlayerCommanderStatsDto, RatingHistoryDto, LeaderboardEntry,
  CommanderMetaReportDto,
  CreateEventDto, EventDto, RegisterPlayerDto, EventPlayerDto, CheckInResponseDto,
  GameResultSubmit, RoundDto, StandingsEntry, PairingsDto,
  WishlistEntryDto, TradeEntryDto, CreateCardEntryDto, BulkUploadResultDto,
  ThemeDto,
  StoreDto, StoreDetailDto, CreateStoreDto, UpdateStoreDto,
  SuggestedTradeDto, TradeCardDemandDto, WishlistCardSupplyDto,
  AppUserDto, AssignEmployeeDto,
  LicenseDto, CreateLicenseDto, UpdateLicenseDto,
  BulkRegisterConfirmDto, BulkRegisterResultDto,
  EventTemplateDto, CreateEventTemplateDto,
  StorePublicDto,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = '/api';

  constructor(private http: HttpClient) {}

  // Players
  getAllPlayers(): Observable<PlayerDto[]> {
    return this.http.get<PlayerDto[]>(`${this.base}/players`);
  }

  registerPlayer(dto: CreatePlayerDto): Observable<PlayerDto> {
    return this.http.post<PlayerDto>(`${this.base}/players`, dto);
  }

  updatePlayer(id: number, dto: UpdatePlayerDto): Observable<PlayerDto> {
    return this.http.put<PlayerDto>(`${this.base}/players/${id}`, dto);
  }

  uploadPlayerAvatar(playerId: number, file: File): Observable<PlayerDto> {
    const form = new FormData();
    form.append('avatar', file);
    return this.http.post<PlayerDto>(`${this.base}/players/${playerId}/avatar`, form);
  }

  removePlayerAvatar(playerId: number): Observable<PlayerDto> {
    return this.http.delete<PlayerDto>(`${this.base}/players/${playerId}/avatar`);
  }

  getPlayerProfile(id: number): Observable<PlayerProfile> {
    return this.http.get<PlayerProfile>(`${this.base}/players/${id}/profile`);
  }

  getCommanderStats(playerId: number): Observable<PlayerCommanderStatsDto> {
    return this.http.get<PlayerCommanderStatsDto>(`${this.base}/players/${playerId}/commanderstats`);
  }

  getRatingHistory(playerId: number): Observable<RatingHistoryDto> {
    return this.http.get<RatingHistoryDto>(`${this.base}/players/${playerId}/ratinghistory`);
  }

  // Leaderboard
  getLeaderboard(): Observable<LeaderboardEntry[]> {
    return this.http.get<LeaderboardEntry[]>(`${this.base}/leaderboard`);
  }

  // Events
  getAllEvents(storeId?: number | null): Observable<EventDto[]> {
    const url = storeId ? `${this.base}/events?storeId=${storeId}` : `${this.base}/events`;
    return this.http.get<EventDto[]>(url);
  }

  createEvent(dto: CreateEventDto): Observable<EventDto> {
    return this.http.post<EventDto>(`${this.base}/events`, dto);
  }

  getEvent(id: number): Observable<EventDto> {
    return this.http.get<EventDto>(`${this.base}/events/${id}`);
  }

  registerForEvent(eventId: number, dto: RegisterPlayerDto): Observable<any> {
    return this.http.post(`${this.base}/events/${eventId}/register`, dto);
  }

  updateEventStatus(eventId: number, status: string, plannedRounds?: number): Observable<EventDto> {
    return this.http.put<EventDto>(`${this.base}/events/${eventId}/status`, { status, plannedRounds });
  }

  getEventPlayers(eventId: number): Observable<EventPlayerDto[]> {
    return this.http.get<EventPlayerDto[]>(`${this.base}/events/${eventId}/players`);
  }

  removeEvent(id: number): Observable<any> {
    return this.http.delete(`${this.base}/events/${id}`);
  }

  dropPlayer(eventId: number, playerId: number): Observable<any> {
    return this.http.delete(`${this.base}/events/${eventId}/players/${playerId}`);
  }

  disqualifyPlayer(eventId: number, playerId: number): Observable<any> {
    return this.http.post(`${this.base}/events/${eventId}/players/${playerId}/disqualify`, {});
  }

  setPlayerDropped(eventId: number, playerId: number, isDropped: boolean): Observable<EventPlayerDto> {
    return this.http.put<EventPlayerDto>(
      `${this.base}/events/${eventId}/players/${playerId}/drop`,
      { isDropped }
    );
  }

  promoteFromWaitlist(eventId: number, playerId: number): Observable<EventPlayerDto> {
    return this.http.post<EventPlayerDto>(
      `${this.base}/events/${eventId}/players/${playerId}/promote`, {}
    );
  }

  setCheckIn(eventId: number, playerId: number, checkedIn: boolean): Observable<EventPlayerDto> {
    return this.http.put<EventPlayerDto>(
      `${this.base}/events/${eventId}/players/${playerId}/checkin`,
      { isCheckedIn: checkedIn }
    );
  }

  declareCommander(eventId: number, playerId: number, dto: { commanders?: string | null; decklistUrl?: string | null }): Observable<EventPlayerDto> {
    return this.http.put<EventPlayerDto>(
      `${this.base}/events/${eventId}/players/${playerId}/commander`,
      dto
    );
  }

  getRounds(eventId: number): Observable<RoundDto[]> {
    return this.http.get<RoundDto[]>(`${this.base}/events/${eventId}/rounds`);
  }

  generateNextRound(eventId: number): Observable<RoundDto> {
    return this.http.post<RoundDto>(`${this.base}/events/${eventId}/rounds`, {});
  }

  getEventPairings(eventId: number): Observable<PairingsDto | null> {
    return this.http.get<PairingsDto | null>(`${this.base}/events/${eventId}/pairings`);
  }

  checkInByToken(token: string): Observable<CheckInResponseDto> {
    return this.http.post<CheckInResponseDto>(`${this.base}/events/checkin/${token}`, {});
  }

  // Games
  submitGameResult(gameId: number, results: GameResultSubmit[]): Observable<any> {
    return this.http.post(`${this.base}/games/${gameId}/result`, results);
  }

  revertGameResult(gameId: number): Observable<any> {
    return this.http.delete(`${this.base}/games/${gameId}/result`);
  }

  // Standings
  getStandings(eventId: number): Observable<StandingsEntry[]> {
    return this.http.get<StandingsEntry[]>(`${this.base}/events/${eventId}/standings`);
  }

  // Wishlist
  getWishlist(playerId: number): Observable<WishlistEntryDto[]> {
    return this.http.get<WishlistEntryDto[]>(`${this.base}/players/${playerId}/wishlist`);
  }

  getWishlistSupply(playerId: number): Observable<WishlistCardSupplyDto[]> {
    return this.http.get<WishlistCardSupplyDto[]>(`${this.base}/players/${playerId}/wishlist/supply`);
  }

  addToWishlist(playerId: number, dto: CreateCardEntryDto): Observable<WishlistEntryDto> {
    return this.http.post<WishlistEntryDto>(`${this.base}/players/${playerId}/wishlist`, dto);
  }

  removeFromWishlist(playerId: number, entryId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/players/${playerId}/wishlist/${entryId}`);
  }

  // For Trade
  getTradeList(playerId: number): Observable<TradeEntryDto[]> {
    return this.http.get<TradeEntryDto[]>(`${this.base}/players/${playerId}/trades`);
  }

  addToTradeList(playerId: number, dto: CreateCardEntryDto): Observable<TradeEntryDto> {
    return this.http.post<TradeEntryDto>(`${this.base}/players/${playerId}/trades`, dto);
  }

  removeFromTradeList(playerId: number, entryId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/players/${playerId}/trades/${entryId}`);
  }

  bulkUploadWishlist(playerId: number, file: File): Observable<BulkUploadResultDto> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<BulkUploadResultDto>(`${this.base}/players/${playerId}/wishlist/bulkupload`, form);
  }

  bulkUploadTradeList(playerId: number, file: File): Observable<BulkUploadResultDto> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<BulkUploadResultDto>(`${this.base}/players/${playerId}/trades/bulkupload`, form);
  }

  removeAllFromWishlist(playerId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/players/${playerId}/wishlist/removeall`);
  }

  removeAllFromTradeList(playerId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/players/${playerId}/trades/removeall`);
  }

  // Themes
  getThemes(): Observable<ThemeDto[]> {
    return this.http.get<ThemeDto[]>(`${this.base}/themes`);
  }

  // Stores
  getStores(): Observable<StoreDto[]> {
    return this.http.get<StoreDto[]>(`${this.base}/stores`);
  }

  getStore(id: number): Observable<StoreDetailDto> {
    return this.http.get<StoreDetailDto>(`${this.base}/stores/${id}`);
  }

  createStore(dto: CreateStoreDto): Observable<StoreDto> {
    return this.http.post<StoreDto>(`${this.base}/stores`, dto);
  }

  updateStore(id: number, dto: UpdateStoreDto): Observable<StoreDetailDto> {
    return this.http.put<StoreDetailDto>(`${this.base}/stores/${id}`, dto);
  }

  testDiscordWebhook(storeId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/stores/${storeId}/discord/test`, {});
  }

  uploadStoreLogo(storeId: number, file: File): Observable<StoreDto> {
    const form = new FormData();
    form.append('logo', file);
    return this.http.post<StoreDto>(`${this.base}/stores/${storeId}/logo`, form);
  }

  getSuggestedTrades(playerId: number): Observable<SuggestedTradeDto[]> {
    return this.http.get<SuggestedTradeDto[]>(`${this.base}/players/${playerId}/trades/suggestions`);
  }

  getTradeDemand(playerId: number): Observable<TradeCardDemandDto[]> {
    return this.http.get<TradeCardDemandDto[]>(`${this.base}/players/${playerId}/trades/demand`);
  }

  // Store employee management
  getStoreEmployees(storeId: number): Observable<AppUserDto[]> {
    return this.http.get<AppUserDto[]>(`${this.base}/stores/${storeId}/employees`);
  }

  addStoreEmployee(storeId: number, dto: AssignEmployeeDto): Observable<AppUserDto> {
    return this.http.post<AppUserDto>(`${this.base}/stores/${storeId}/employees`, dto);
  }

  removeStoreEmployee(storeId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/stores/${storeId}/employees/${userId}`);
  }

  // Admin user management
  getAllUsers(): Observable<AppUserDto[]> {
    return this.http.get<AppUserDto[]>(`${this.base}/users`);
  }

  updateUserRole(userId: number, role: string): Observable<AppUserDto> {
    return this.http.put<AppUserDto>(`${this.base}/users/${userId}/role`, { role });
  }

  // License management
  getStoreLicense(storeId: number): Observable<LicenseDto> {
    return this.http.get<LicenseDto>(`${this.base}/stores/${storeId}/license`);
  }

  createLicense(storeId: number, dto: CreateLicenseDto): Observable<LicenseDto> {
    return this.http.post<LicenseDto>(`${this.base}/stores/${storeId}/license`, dto);
  }

  updateLicense(storeId: number, licenseId: number, dto: UpdateLicenseDto): Observable<LicenseDto> {
    return this.http.put<LicenseDto>(`${this.base}/stores/${storeId}/license/${licenseId}`, dto);
  }

  getCommanderMeta(storeId: number, period: string = '30d'): Observable<CommanderMetaReportDto> {
    return this.http.get<CommanderMetaReportDto>(`${this.base}/stores/${storeId}/meta`, { params: { period } });
  }

  getStorePublicPage(slug: string): Observable<StorePublicDto> {
    return this.http.get<StorePublicDto>(`${this.base}/stores/public/${slug}`);
  }

  bulkRegisterConfirm(eventId: number, dto: BulkRegisterConfirmDto): Observable<BulkRegisterResultDto> {
    return this.http.post<BulkRegisterResultDto>(`${this.base}/events/${eventId}/bulkregister/confirm`, dto);
  }

  // ── Event Templates ────────────────────────────────────────────────────────

  getEventTemplates(storeId: number): Observable<EventTemplateDto[]> {
    return this.http.get<EventTemplateDto[]>(`${this.base}/stores/${storeId}/eventtemplates`);
  }

  createEventTemplate(storeId: number, dto: CreateEventTemplateDto): Observable<EventTemplateDto> {
    return this.http.post<EventTemplateDto>(`${this.base}/stores/${storeId}/eventtemplates`, dto);
  }

  updateEventTemplate(storeId: number, id: number, dto: CreateEventTemplateDto): Observable<EventTemplateDto> {
    return this.http.put<EventTemplateDto>(`${this.base}/stores/${storeId}/eventtemplates/${id}`, dto);
  }

  deleteEventTemplate(storeId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/stores/${storeId}/eventtemplates/${id}`);
  }
}
