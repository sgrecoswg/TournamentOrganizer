import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CardDemandDialogComponent } from './dialogs/card-demand-dialog.component';
import { ApiService } from '../../core/services/api.service';
import { ScryfallService } from '../../core/services/scryfall.service';
import { AuthService } from '../../core/services/auth.service';
import { PlayerService } from '../../core/services/player.service';
import { LocalStorageContext } from '../../core/services/local-storage-context.service';
import { PlayerProfile, WishlistEntryDto, TradeEntryDto, BulkUploadResultDto, SuggestedTradeDto, TradeCardDemandDto, CommanderStatDto } from '../../core/models/api.models';
import { RatingBadgeComponent } from '../../shared/components/rating-badge.component';
import { PlacementBadgeComponent } from '../../shared/components/placement-badge.component';

@Component({
  selector: 'app-player-profile',
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatTableModule, MatTabsModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule, MatTooltipModule, MatPaginatorModule,
    MatProgressSpinnerModule, MatAutocompleteModule,
    RatingBadgeComponent, PlacementBadgeComponent
  ],
  template: `
    @if (profile) {
      <div class="avatar-section">
        @if (profile.avatarUrl) {
          <img [src]="profile.avatarUrl" alt="Avatar" class="player-avatar" />
        } @else {
          <div class="player-avatar player-avatar-placeholder">
            <mat-icon>person</mat-icon>
          </div>
        }
        @if (canManageAvatar) {
          <div class="avatar-actions">
            <button mat-icon-button
                    matTooltip="Upload avatar"
                    (click)="avatarInput.click()"
                    [disabled]="uploadingAvatar">
              <mat-icon>upload</mat-icon>
            </button>
            <input #avatarInput
                   type="file"
                   accept=".png,.jpg,.jpeg,.gif,.webp"
                   style="display:none"
                   (change)="onAvatarFileSelected($event)" />
            @if (profile.avatarUrl) {
              <button mat-icon-button
                      matTooltip="Remove avatar"
                      color="warn"
                      (click)="removeAvatar()">
                <mat-icon>delete</mat-icon>
              </button>
            }
          </div>
        }
      </div>

      <div class="profile-header">
        @if (isEditing) {
          <div class="edit-form">
            <mat-form-field>
              <mat-label>Name</mat-label>
              <input matInput [(ngModel)]="editName">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Email</mat-label>
              <input matInput [(ngModel)]="editEmail">
            </mat-form-field>
            <div class="edit-actions">
              <button mat-raised-button color="primary" (click)="saveEdit()">Save</button>
              <button mat-button (click)="cancelEdit()">Cancel</button>
            </div>
          </div>
        } @else {
          <div class="name-row">
            <h2>{{ profile.name }}</h2>
            <button mat-icon-button (click)="startEdit()">
              <mat-icon>edit</mat-icon>
            </button>
          </div>
        }
        <div class="header-details">
          <div class="rating-main">
            <app-rating-badge [score]="profile.conservativeScore"></app-rating-badge>
            <app-placement-badge [isRanked]="profile.isRanked" [gamesLeft]="profile.placementGamesLeft"></app-placement-badge>
          </div>
          <div class="header-info">
            <span><strong>Mu:</strong> {{ profile.mu | number:'1.2-2' }}</span>
            <span><strong>σ:</strong> {{ profile.sigma | number:'1.2-2' }}</span>
            <span><strong>Score:</strong> {{ profile.conservativeScore | number:'1.2-2' }}</span>            
            <span><strong>Games:</strong> {{ profile.gameHistory.length }}</span>
            <span><strong>Wins:</strong> {{ getWins() }}</span>
          </div>
        </div>
      </div>

      @if (commanderStats.length) {
        <div class="commander-stats-section">
          <h3>My Commanders</h3>
          <mat-card>
            <mat-card-content>
              <table mat-table [dataSource]="commanderStats" class="full-width">
                <ng-container matColumnDef="commanderName">
                  <th mat-header-cell *matHeaderCellDef>Commander(s)</th>
                  <td mat-cell *matCellDef="let row">{{ row.commanderName }}</td>
                </ng-container>
                <ng-container matColumnDef="gamesPlayed">
                  <th mat-header-cell *matHeaderCellDef>Games</th>
                  <td mat-cell *matCellDef="let row">{{ row.gamesPlayed }}</td>
                </ng-container>
                <ng-container matColumnDef="wins">
                  <th mat-header-cell *matHeaderCellDef>Wins</th>
                  <td mat-cell *matCellDef="let row">{{ row.wins }}</td>
                </ng-container>
                <ng-container matColumnDef="winPct">
                  <th mat-header-cell *matHeaderCellDef>Win %</th>
                  <td mat-cell *matCellDef="let row">
                    {{ row.gamesPlayed > 0 ? (row.wins / row.gamesPlayed * 100).toFixed(1) : '0.0' }}%
                  </td>
                </ng-container>
                <ng-container matColumnDef="avgFinish">
                  <th mat-header-cell *matHeaderCellDef>Avg Finish</th>
                  <td mat-cell *matCellDef="let row">{{ row.avgFinish | number:'1.1-2' }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="commanderColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: commanderColumns;"></tr>
              </table>
            </mat-card-content>
          </mat-card>
        </div>
      }

      <mat-tab-group>

        <!-- History tab -->
        @if (apiOnline) {
        <mat-tab label="History">
          <div class="tab-content">
            @if (profile.eventRegistrations.length > 0) {
              <h3>Event History</h3>
              <mat-card>
                <mat-card-content>
                  <table mat-table [dataSource]="pagedRegistrations" class="full-width">
                    <ng-container matColumnDef="eventName">
                      <th mat-header-cell *matHeaderCellDef>Event</th>
                      <td mat-cell *matCellDef="let row">
                        <a [routerLink]="['/events', row.eventId]">{{ row.eventName }}</a>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="eventDate">
                      <th mat-header-cell *matHeaderCellDef>Date</th>
                      <td mat-cell *matCellDef="let row">{{ row.eventDate | date:'mediumDate' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="decklist">
                      <th mat-header-cell *matHeaderCellDef>Decklist</th>
                      <td mat-cell *matCellDef="let row">
                        @if (row.decklistUrl) {
                          <a [href]="row.decklistUrl" target="_blank" rel="noopener">View</a>
                        } @else { - }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="commander">
                      <th mat-header-cell *matHeaderCellDef>Commander(s)</th>
                      <td mat-cell *matCellDef="let row">{{ row.commanders ?? '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="store">
                      <th mat-header-cell *matHeaderCellDef>Store</th>
                      <td mat-cell *matCellDef="let row">{{ row.storeName ?? '-' }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="eventColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: eventColumns;"></tr>
                  </table>
                  <mat-paginator
                    [length]="profile.eventRegistrations.length"
                    [pageSize]="historyPageSize"
                    [pageSizeOptions]="[5, 10, 25]"
                    (page)="onHistoryPage($event)">
                  </mat-paginator>
                </mat-card-content>
              </mat-card>
            }

            @if (profile.eventRegistrations.length === 0) {
              <p class="empty-state">No history yet.</p>
            }
          </div>
        </mat-tab>
        }

        <!-- Trading tab -->
        @if (apiOnline) {
        <mat-tab label="Trading">
          <div class="tab-content">
            <mat-tab-group>

              <!-- Wishlist sub-tab -->
              <mat-tab label="Wishlist ({{ wishlist.length }})">
                <div class="tab-content">
                  @if (canEditProfile) {
                    <div class="add-card-form">
                      <mat-form-field>
                        <mat-label>Card name</mat-label>
                        <input matInput
                               [(ngModel)]="newWishlistCard"
                               [matAutocomplete]="wishlistAuto"
                               (ngModelChange)="onWishlistCardChange($event)"
                               (keydown.enter)="addToWishlist()"
                               placeholder="e.g. Lightning Bolt">
                        <mat-autocomplete #wishlistAuto="matAutocomplete">
                          @for (s of wishlistSuggestions; track s) {
                            <mat-option [value]="s">{{ s }}</mat-option>
                          }
                        </mat-autocomplete>
                      </mat-form-field>
                      <mat-form-field class="qty-field">
                        <mat-label>Qty</mat-label>
                        <input matInput type="number" [(ngModel)]="newWishlistQty" min="1">
                      </mat-form-field>
                      <button mat-raised-button color="primary" (click)="addToWishlist()" [disabled]="!newWishlistCard.trim()">
                        <mat-icon>add</mat-icon> Add
                      </button>
                      <button mat-stroked-button (click)="wishlistFileInput.click()">
                        <mat-icon>upload_file</mat-icon> Bulk Import
                      </button>
                      <button mat-stroked-button color="warn" (click)="removeAllFromWishlist()" [disabled]="wishlist.length === 0">
                        <mat-icon>delete_sweep</mat-icon> Remove All
                      </button>
                      <input #wishlistFileInput type="file" accept=".txt" style="display:none"
                             (change)="onWishlistFileSelected($event)">
                    </div>
                  }

                  @if (wishlist.length > 0) {
                    <mat-card>
                      <mat-card-content>
                        <table mat-table [dataSource]="wishlist" class="full-width">
                          <ng-container matColumnDef="cardName">
                            <th mat-header-cell *matHeaderCellDef>Card</th>
                            <td mat-cell *matCellDef="let row">{{ row.cardName }}</td>
                          </ng-container>
                          <ng-container matColumnDef="quantity">
                            <th mat-header-cell *matHeaderCellDef>Qty</th>
                            <td mat-cell *matCellDef="let row">{{ row.quantity }}</td>
                          </ng-container>
                          <ng-container matColumnDef="price">
                            <th mat-header-cell *matHeaderCellDef>Price (USD)</th>
                            <td mat-cell *matCellDef="let row">
                              {{ row.usdPrice != null ? ('$' + (row.usdPrice | number:'1.2-2')) : '-' }}
                            </td>
                          </ng-container>
                          <ng-container matColumnDef="sellers">
                            <th mat-header-cell *matHeaderCellDef>Available from</th>
                            <td mat-cell *matCellDef="let row">
                              @if (wishlistSupply.get(row.cardName.toLowerCase())?.length) {
                                <span class="sellers-list"
                                      [matTooltip]="wishlistSupply.get(row.cardName.toLowerCase())!.join(', ')">
                                  <mat-icon class="sellers-icon">swap_horiz</mat-icon>
                                  {{ wishlistSupply.get(row.cardName.toLowerCase())!.join(', ') }}
                                </span>
                              } @else {
                                <span class="no-sellers">—</span>
                              }
                            </td>
                          </ng-container>
                          <ng-container matColumnDef="remove">
                            <th mat-header-cell *matHeaderCellDef></th>
                            <td mat-cell *matCellDef="let row">
                              <button mat-icon-button color="warn" (click)="removeFromWishlist(row.id)">
                                <mat-icon>delete</mat-icon>
                              </button>
                            </td>
                          </ng-container>
                          <tr mat-header-row *matHeaderRowDef="cardColumns"></tr>
                          <tr mat-row *matRowDef="let row; columns: cardColumns;"></tr>
                        </table>
                      </mat-card-content>
                    </mat-card>
                  } @else {
                    <p class="empty-state">No cards on wishlist yet.</p>
                  }
                </div>
              </mat-tab>

              <!-- For Trade sub-tab -->
              <mat-tab label="For Trade ({{ tradeList.length }})">
                <div class="tab-content demand-legend">
                  <span class="legend-item"><mat-icon style="color:#9e9e9e;font-size:18px;vertical-align:middle">check_circle</mat-icon> &lt;10%</span>
                  <span class="legend-item"><mat-icon style="color:#1976d2;font-size:18px;vertical-align:middle">trending_up</mat-icon> 10–49%</span>
                  <span class="legend-item"><mat-icon style="color:#ff9800;font-size:18px;vertical-align:middle">bolt</mat-icon> 50–99%</span>
                  <span class="legend-item"><mat-icon style="color:#f44336;font-size:18px;vertical-align:middle">whatshot</mat-icon> 100%</span>
                </div>
                <div class="tab-content">
                  @if (canEditProfile) {
                    <div class="add-card-form">
                      <mat-form-field>
                        <mat-label>Card name</mat-label>
                        <input matInput
                               [(ngModel)]="newTradeCard"
                               [matAutocomplete]="tradeAuto"
                               (ngModelChange)="onTradeCardChange($event)"
                               (keydown.enter)="addToTradeList()"
                               placeholder="e.g. Sol Ring">
                        <mat-autocomplete #tradeAuto="matAutocomplete">
                          @for (s of tradeSuggestions; track s) {
                            <mat-option [value]="s">{{ s }}</mat-option>
                          }
                        </mat-autocomplete>
                      </mat-form-field>
                      <mat-form-field class="qty-field">
                        <mat-label>Qty</mat-label>
                        <input matInput type="number" [(ngModel)]="newTradeQty" min="1">
                      </mat-form-field>
                      <button mat-raised-button color="accent" (click)="addToTradeList()" [disabled]="!newTradeCard.trim()">
                        <mat-icon>add</mat-icon> Add
                      </button>
                      <button mat-stroked-button (click)="tradeFileInput.click()">
                        <mat-icon>upload_file</mat-icon> Bulk Import
                      </button>
                      <button mat-stroked-button color="warn" (click)="removeAllFromTradeList()" [disabled]="tradeList.length === 0">
                        <mat-icon>delete_sweep</mat-icon> Remove All
                      </button>
                      <input #tradeFileInput type="file" accept=".txt" style="display:none"
                             (change)="onTradeFileSelected($event)">
                    </div>
                  }

                  @if (tradeList.length > 0) {
                    <mat-card>
                      <mat-card-content>
                        <table mat-table [dataSource]="tradeList" class="full-width">
                          <ng-container matColumnDef="demand">
                            <th mat-header-cell *matHeaderCellDef></th>
                            <td mat-cell *matCellDef="let row" class="demand-cell">
                              @if (getDemandIcon(row.cardName); as icon) {
                                <mat-icon [attr.style]="getDemandStyle(row.cardName)"
                                          [matTooltip]="getDemandTooltip(row.cardName)">{{ icon }}</mat-icon>
                              }
                            </td>
                          </ng-container>
                          <ng-container matColumnDef="cardName">
                            <th mat-header-cell *matHeaderCellDef>Card</th>
                            <td mat-cell *matCellDef="let row">
                              <button mat-button class="card-name-btn" (click)="openDemandDialog(row.cardName)">{{ row.cardName }}</button>
                            </td>
                          </ng-container>
                          <ng-container matColumnDef="quantity">
                            <th mat-header-cell *matHeaderCellDef>Qty</th>
                            <td mat-cell *matCellDef="let row">{{ row.quantity }}</td>
                          </ng-container>
                          <ng-container matColumnDef="price">
                            <th mat-header-cell *matHeaderCellDef>Price (USD)</th>
                            <td mat-cell *matCellDef="let row">
                              {{ row.usdPrice != null ? ('$' + (row.usdPrice | number:'1.2-2')) : '-' }}
                            </td>
                          </ng-container>
                          <ng-container matColumnDef="remove">
                            <th mat-header-cell *matHeaderCellDef></th>
                            <td mat-cell *matCellDef="let row">
                              <button mat-icon-button color="warn" (click)="removeFromTradeList(row.id)">
                                <mat-icon>delete</mat-icon>
                              </button>
                            </td>
                          </ng-container>
                          <tr mat-header-row *matHeaderRowDef="tradeColumns"></tr>
                          <tr mat-row *matRowDef="let row; columns: tradeColumns;"></tr>
                        </table>
                      </mat-card-content>
                    </mat-card>
                  } @else {
                    <p class="empty-state">No cards listed for trade yet.</p>
                  }
                </div>
              </mat-tab>

              <!-- Suggested Trades sub-tab -->
              <mat-tab label="Suggested Trades">
                <div class="tab-content">
                  <div class="suggestions-toolbar">
                    <button mat-stroked-button (click)="refreshSuggestions()">
                      <mat-icon>refresh</mat-icon> Refresh
                    </button>
                  </div>
                  @if (suggestedTrades.length > 0) {
                    @for (trade of suggestedTrades; track $index) {
                      <mat-card class="trade-card">
                        <mat-card-header>
                          <mat-card-title>{{ trade.type === 'TwoPlayer' ? '2-Player Trade' : 'Cycle Trade' }}</mat-card-title>
                          <mat-card-subtitle>{{ trade.participantNames.join(' · ') }}</mat-card-subtitle>
                        </mat-card-header>
                        <mat-card-content>
                          <div class="trade-legs">
                            @for (leg of trade.legs; track $index) {
                              <div class="trade-leg">
                                <strong>{{ leg.fromPlayerName }}</strong>
                                gives <em>{{ leg.cardName }}</em>
                                @if (leg.quantity > 1) { (×{{ leg.quantity }}) }
                                {{ leg.usdPrice != null ? ('($' + (leg.usdPrice | number:'1.2-2') + ')') : '' }}
                                → <strong>{{ leg.toPlayerName }}</strong>
                              </div>
                            }
                          </div>
                        </mat-card-content>
                      </mat-card>
                    }
                  } @else {
                    <p class="empty-state">No suggested trades found. Make sure players have wishlists and for-trade lists with priced cards.</p>
                  }
                </div>
              </mat-tab>

            </mat-tab-group>
          </div>
        </mat-tab>
        }

      </mat-tab-group>
    }
  `,
  styles: [`
    .avatar-section { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 16px; }
    .player-avatar { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 2px solid var(--mat-sys-outline-variant, #ccc); }
    .player-avatar-placeholder { display: flex; align-items: center; justify-content: center; background: var(--mat-sys-surface-variant, #e0e0e0); }
    .player-avatar-placeholder mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .avatar-actions { display: flex; gap: 4px; }
    .profile-header { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
    .name-row { display: flex; align-items: center; justify-content: space-between; }
    .name-row h2 { margin: 0; }
    .header-details { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
    .rating-main { display: flex; gap: 8px; align-items: center; }
    .header-info { display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.9rem; color: #555; }
    .edit-form { display: flex; gap: 16px; align-items: baseline; flex-wrap: wrap; }
    .edit-actions { display: flex; gap: 8px; }
    .add-card-form { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; margin-bottom: 16px; }
    .qty-field { width: 80px; }
    .empty-state { color: #666; font-style: italic; }
    h3 { margin-top: 16px; }
    .demand-legend { display: flex; gap: 16px; align-items: center; padding: 4px 0 8px; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #555; }
    .demand-cell { width: 32px; padding-right: 0; }
    .card-name-btn { padding: 0 4px; min-width: unset; font-size: 14px; text-align: left; }
    .sellers-list { display: flex; align-items: center; gap: 4px; color: #1976d2; font-size: 13px; cursor: default; }
    .sellers-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    .no-sellers { color: #aaa; }
    .suggestions-toolbar { margin-bottom: 16px; }
    .trade-card { margin-bottom: 16px; }
    .trade-legs { display: flex; flex-direction: column; gap: 8px; }
    .trade-leg { font-size: 14px; }
  `]
})
export class PlayerProfileComponent implements OnInit {
  profile: PlayerProfile | null = null;
  commanderStats: CommanderStatDto[] = [];
  wishlist: WishlistEntryDto[] = [];
  wishlistSupply = new Map<string, string[]>();
  tradeList: TradeEntryDto[] = [];
  suggestedTrades: SuggestedTradeDto[] = [];
  tradeDemand = new Map<string, TradeCardDemandDto>();

  eventColumns = ['eventName', 'eventDate', 'decklist', 'commander', 'store'];
  commanderColumns = ['commanderName', 'gamesPlayed', 'wins', 'winPct', 'avgFinish'];
  historyPageSize = 10;
  historyPageIndex = 0;

  get pagedRegistrations() {
    const start = this.historyPageIndex * this.historyPageSize;
    return this.profile?.eventRegistrations.slice(start, start + this.historyPageSize) ?? [];
  }

  onHistoryPage(event: PageEvent) {
    this.historyPageSize = event.pageSize;
    this.historyPageIndex = event.pageIndex;
    this.cdr.detectChanges();
  }
  get cardColumns(): string[] {
    return this.canEditProfile
      ? ['cardName', 'quantity', 'price', 'sellers', 'remove']
      : ['cardName', 'quantity', 'price', 'sellers'];
  }

  get tradeColumns(): string[] {
    return this.canEditProfile
      ? ['demand', 'cardName', 'quantity', 'price', 'remove']
      : ['demand', 'cardName', 'quantity', 'price'];
  }

  uploadingAvatar = false;

  apiOnline = true;
  isEditing = false;
  editName = '';
  editEmail = '';

  newWishlistCard = '';
  newWishlistQty = 1;
  newTradeCard = '';
  newTradeQty = 1;

  wishlistSuggestions: string[] = [];
  tradeSuggestions: string[] = [];
  private wishlistQuery$ = new Subject<string>();
  private tradeQuery$ = new Subject<string>();

  constructor(
    private route: ActivatedRoute,
    private playerService: PlayerService,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private authService: AuthService,
    private ctx: LocalStorageContext,
    private scryfallService: ScryfallService,
  ) {}

  onWishlistCardChange(query: string): void { this.wishlistQuery$.next(query); }
  onTradeCardChange(query: string): void    { this.tradeQuery$.next(query); }

  get canEditProfile(): boolean {
    const user = this.authService.currentUser;
    if (!user) return false;
    if (user.role === 'Administrator') return true;
    return user.playerId === this.profile?.id;
  }

  get canManageAvatar(): boolean {
    if (this.authService.isAdmin) return true;
    if (this.authService.isStoreManager) return true;
    return this.authService.currentUser?.email === this.profile?.email;
  }

  onAvatarFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.profile) return;
    this.uploadingAvatar = true;
    this.cdr.detectChanges();
    this.apiService.uploadPlayerAvatar(this.profile.id, file).subscribe({
      next: (dto) => {
        this.profile!.avatarUrl = dto.avatarUrl ? `${dto.avatarUrl}?t=${Date.now()}` : null;
        this.uploadingAvatar = false;
        this.snackBar.open('Avatar updated.', 'Close', { duration: 3000 });
        this.playerService.refreshPlayersFromApi().subscribe();
        this.cdr.detectChanges();
      },
      error: () => {
        this.uploadingAvatar = false;
        this.snackBar.open('Upload failed. Check file type and size.', 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  removeAvatar(): void {
    if (!this.profile) return;
    this.apiService.removePlayerAvatar(this.profile.id).subscribe({
      next: (dto) => {
        this.profile!.avatarUrl = dto.avatarUrl ?? null;
        this.snackBar.open('Avatar removed.', 'Close', { duration: 3000 });
        this.playerService.refreshPlayersFromApi().subscribe();
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to remove avatar.', 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  ngOnInit() {
    this.wishlistQuery$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(q => this.scryfallService.getSuggestions(q)),
    ).subscribe(s => { this.wishlistSuggestions = s; this.cdr.detectChanges(); });

    this.tradeQuery$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(q => this.scryfallService.getSuggestions(q)),
    ).subscribe(s => { this.tradeSuggestions = s; this.cdr.detectChanges(); });

    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.playerService.getProfile(id).subscribe({
      next: p => {
        p.eventRegistrations.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
        if (p.avatarUrl && !p.avatarUrl.includes('?t=')) {
          p.avatarUrl = `${p.avatarUrl}?t=${Date.now()}`;
        }
        this.profile = p;
        this.cdr.detectChanges();
        this.loadWishlist(id);
        this.loadWishlistSupply(id);
        this.loadTradeList(id);
        this.loadSuggestedTrades(id);
        this.loadTradeDemand(id);
        this.loadCommanderStats(id);
      },
      error: () => {
        this.apiOnline = false;
        // Fall back to the locally-cached PlayerDto so the page isn't blank
        const cached = this.ctx.players.getById(id);
        if (cached) {
          this.profile = { ...cached, gameHistory: [], eventRegistrations: [] };
        } else {
          this.snackBar.open('Player profile unavailable offline', 'OK', { duration: 3000 });
        }
        this.cdr.detectChanges();
      }
    });
  }

  private loadCommanderStats(playerId: number) {
    this.apiService.getCommanderStats(playerId).subscribe({
      next: stats => { this.commanderStats = stats.commanders; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  private loadWishlist(playerId: number) {
    this.apiService.getWishlist(playerId).subscribe({
      next: list => { this.wishlist = list; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  private loadWishlistSupply(playerId: number) {
    this.apiService.getWishlistSupply(playerId).subscribe({
      next: supply => {
        this.wishlistSupply = new Map(supply.map(s => [s.cardName.toLowerCase(), s.sellerPlayerNames]));
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private loadTradeList(playerId: number) {
    this.apiService.getTradeList(playerId).subscribe({
      next: list => { this.tradeList = list; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  private loadSuggestedTrades(playerId: number) {
    this.apiService.getSuggestedTrades(playerId).subscribe({
      next: trades => {
        this.suggestedTrades = trades;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  refreshSuggestions() {
    if (!this.profile) return;
    this.loadSuggestedTrades(this.profile.id);
  }

  private loadTradeDemand(playerId: number) {
    this.apiService.getTradeDemand(playerId).subscribe({
      next: demand => {
        this.tradeDemand = new Map(demand.map(d => [d.cardName.toLowerCase(), d]));
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  openDemandDialog(cardName: string) {
    const demand = this.tradeDemand.get(cardName.toLowerCase());
    this.dialog.open(CardDemandDialogComponent, {
      data: { cardName, playerNames: demand?.interestedPlayerNames ?? [] },
      width: '320px'
    });
  }

  getDemandIcon(cardName: string): string | null {
    const pct = this.tradeDemand.get(cardName.toLowerCase())?.demandPercent;
    if (pct == null || pct === 0) return null;
    if (pct < 10) return 'check_circle';
    if (pct < 50) return 'trending_up';
    if (pct < 100) return 'bolt';
    return 'whatshot';
  }

  getDemandStyle(cardName: string): string {
    const pct = this.tradeDemand.get(cardName.toLowerCase())?.demandPercent ?? 0;
    if (pct === 0) return '';
    if (pct < 10) return 'color:#9e9e9e';
    if (pct < 50) return 'color:#1976d2';
    if (pct < 100) return 'color:#ff9800';
    return 'color:#f44336';
  }

  getDemandTooltip(cardName: string): string {
    const pct = this.tradeDemand.get(cardName.toLowerCase())?.demandPercent;
    if (pct == null || pct === 0) return '';
    return `${pct.toFixed(0)}% of players want this`;
  }

  addToWishlist() {
    if (!this.canEditProfile || !this.profile || !this.newWishlistCard.trim()) return;
    this.apiService.addToWishlist(this.profile.id, { cardName: this.newWishlistCard.trim(), quantity: this.newWishlistQty }).subscribe({
      next: entry => {
        this.wishlist = [...this.wishlist, entry];
        this.newWishlistCard = '';
        this.newWishlistQty = 1;
        this.loadWishlistSupply(this.profile!.id);
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to add card', 'OK', { duration: 3000 })
    });
  }

  removeFromWishlist(id: number) {
    if (!this.canEditProfile || !this.profile) return;
    this.apiService.removeFromWishlist(this.profile.id, id).subscribe({
      next: () => {
        this.wishlist = this.wishlist.filter(e => e.id !== id);
        this.loadWishlistSupply(this.profile!.id);
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to remove card', 'OK', { duration: 3000 })
    });
  }

  addToTradeList() {
    if (!this.canEditProfile || !this.profile || !this.newTradeCard.trim()) return;
    this.apiService.addToTradeList(this.profile.id, { cardName: this.newTradeCard.trim(), quantity: this.newTradeQty }).subscribe({
      next: entry => {
        this.tradeList = [...this.tradeList, entry];
        this.newTradeCard = '';
        this.newTradeQty = 1;
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to add card', 'OK', { duration: 3000 })
    });
  }

  removeFromTradeList(id: number) {
    if (!this.canEditProfile || !this.profile) return;
    this.apiService.removeFromTradeList(this.profile.id, id).subscribe({
      next: () => {
        this.tradeList = this.tradeList.filter(e => e.id !== id);
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to remove card', 'OK', { duration: 3000 })
    });
  }

  removeAllFromWishlist() {
    if (!this.canEditProfile || !this.profile || !confirm('Remove all cards from wishlist?')) return;
    this.apiService.removeAllFromWishlist(this.profile.id).subscribe({
      next: () => {
        this.wishlist = [];
        this.wishlistSupply.clear();
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to remove all cards', 'OK', { duration: 3000 })
    });
  }

  removeAllFromTradeList() {
    if (!this.canEditProfile || !this.profile || !confirm('Remove all cards from trade list?')) return;
    this.apiService.removeAllFromTradeList(this.profile.id).subscribe({
      next: () => {
        this.tradeList = [];
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to remove all cards', 'OK', { duration: 3000 })
    });
  }

  onWishlistFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!this.canEditProfile || !file || !this.profile) return;
    this.apiService.bulkUploadWishlist(this.profile.id, file).subscribe({
      next: (result: BulkUploadResultDto) => {
        const msg = `${result.added} card(s) added` + (result.errors.length ? `, ${result.errors.length} line(s) skipped` : '');
        this.snackBar.open(msg, 'OK', { duration: 4000 });
        this.loadWishlist(this.profile!.id);
        this.loadWishlistSupply(this.profile!.id);
        (event.target as HTMLInputElement).value = '';
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Bulk import failed', 'OK', { duration: 3000 })
    });
  }

  onTradeFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!this.canEditProfile || !file || !this.profile) return;
    this.apiService.bulkUploadTradeList(this.profile.id, file).subscribe({
      next: (result: BulkUploadResultDto) => {
        const msg = `${result.added} card(s) added` + (result.errors.length ? `, ${result.errors.length} line(s) skipped` : '');
        this.snackBar.open(msg, 'OK', { duration: 4000 });
        this.loadTradeList(this.profile!.id);
        (event.target as HTMLInputElement).value = '';
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Bulk import failed', 'OK', { duration: 3000 })
    });
  }

  getWins(): number {
    return this.profile?.gameHistory.filter(g => g.finishPosition === 1).length ?? 0;
  }

  startEdit() {
    if (!this.profile) return;
    this.editName = this.profile.name;
    this.editEmail = this.profile.email;
    this.isEditing = true;
    this.cdr.detectChanges();
  }

  cancelEdit() {
    this.isEditing = false;
    this.cdr.detectChanges();
  }

  saveEdit() {
    if (!this.profile) return;
    this.playerService.updatePlayer(this.profile.id, {
      name: this.editName,
      email: this.editEmail,
      isActive: this.profile.isActive
    }).subscribe({
      next: () => {
        this.profile!.name = this.editName;
        this.profile!.email = this.editEmail;
        this.isEditing = false;
        this.cdr.detectChanges();
        this.snackBar.open('Profile updated!', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to update', 'OK', { duration: 3000 });
      }
    });
  }
}
