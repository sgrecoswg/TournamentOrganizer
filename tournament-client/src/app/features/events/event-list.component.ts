import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { Subscription } from 'rxjs';
import { EventService } from '../../core/services/event.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { StoreContextService } from '../../core/services/store-context.service';
import { SyncService } from '../../core/services/sync.service';
import { EventDto, EventTemplateDto, PointSystem, POINT_SYSTEM_LABELS } from '../../core/models/api.models';

@Component({
  selector: 'app-event-list',
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatChipsModule, MatIconModule, MatSnackBarModule,
    MatDatepickerModule, MatNativeDateModule, MatTabsModule, MatSelectModule
  ],
  template: `
    @if (storeBackgroundUrl) {
      <div class="event-list-header" [style.backgroundImage]="'url(' + storeBackgroundUrl + ')'"></div>
    }
    <h2>Events</h2>

    @if (canCreateEvent) {
      <mat-card class="create-card">
        <mat-card-header>
          <mat-card-title>Create New Event</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="form-row">
            <mat-form-field>
              <mat-label>Event Name</mat-label>
              <input matInput [(ngModel)]="newName" placeholder="Friday Night Commander">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Date</mat-label>
              <input matInput [matDatepicker]="picker" [(ngModel)]="newDate" placeholder="Choose a date">
              <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
            <mat-form-field class="time-field">
              <mat-label>Round Time (min)</mat-label>
              <input matInput [(ngModel)]="newRoundTime" type="number" min="10" max="120">
            </mat-form-field>
            <mat-form-field class="time-field">
              <mat-label>Max Players</mat-label>
              <input matInput [(ngModel)]="newMaxPlayers" type="number" min="4" placeholder="Unlimited">
            </mat-form-field>
            <mat-form-field class="point-system-field">
              <mat-label>Point System</mat-label>
              <mat-select [(ngModel)]="newPointSystem">
                @for (opt of pointSystemOptions; track opt.value) {
                  <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            @if (templates.length > 0) {
              <mat-form-field class="template-field">
                <mat-label>Use Template</mat-label>
                <mat-select (ngModelChange)="applyTemplate($event)" [(ngModel)]="selectedTemplateId">
                  @for (t of templates; track t.id) {
                    <mat-option [value]="t.id">{{ t.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
            <button mat-raised-button color="primary" (click)="createEvent()"
                    [disabled]="!newName || !newDate || (authService.isAdmin && !authService.currentUser?.storeId && !storeContext.selectedStoreId)">
              Create Event
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    }

    <mat-tab-group>
      @for (tab of tabs; track tab.label) {
        <mat-tab [label]="tab.label">
          <div class="event-grid">
            @for (evt of filteredEvents(tab.status); track evt.id) {
              <mat-card class="event-card" [routerLink]="['/events', evt.id]">
                <mat-card-header>
                  <mat-card-title>{{ evt.name }}</mat-card-title>
                  <mat-card-subtitle>{{ evt.date | date:'mediumDate' }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="event-info">
                    <mat-chip>{{ evt.status }}</mat-chip>
                    <mat-chip>{{ evt.pointSystem === 'WinBased' ? 'Win-Based' : 'Score-Based' }}</mat-chip>
                    <span>
                      {{ evt.playerCount }}{{ evt.maxPlayers ? '/' + evt.maxPlayers : '' }} players
                      @if (evt.maxPlayers && evt.playerCount < evt.maxPlayers) {
                        <span class="slots-remaining">({{ evt.maxPlayers - evt.playerCount }} remaining)</span>
                      }
                    </span>
                    @if (evt.maxPlayers && evt.playerCount >= evt.maxPlayers) {
                      <mat-chip color="warn" highlighted>Full</mat-chip>
                    }
                  </div>
                </mat-card-content>
                @if (authService.isStoreEmployee) {
                  <mat-card-actions>
                    @if (isOffline(evt)) {
                      <button mat-button color="accent" class="sync-btn" (click)="syncEvent(evt, $event)">
                        <mat-icon>sync</mat-icon> Sync
                      </button>
                    }
                    <button mat-button color="warn" (click)="removeEvent(evt.id, $event)">
                      <mat-icon>delete</mat-icon> Remove
                    </button>
                  </mat-card-actions>
                }
              </mat-card>
            } @empty {
              <p class="empty-state">No {{ tab.label.toLowerCase() }} events.</p>
            }
          </div>
        </mat-tab>
      }
    </mat-tab-group>
  `,
  styles: [`
    .create-card { margin-bottom: 24px; }
    .form-row { display: flex; gap: 16px; align-items: baseline; flex-wrap: wrap; }
    .time-field { width: 120px; }
    .point-system-field { min-width: 200px; }
    .event-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding: 16px 0; }
    .event-card { cursor: pointer; }
    .event-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .event-info { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .slots-remaining { color: #888; font-size: 0.82rem; margin-left: 2px; }
    .empty-state { color: #888; font-style: italic; padding: 16px 0; }
    .template-field { min-width: 200px; }
  `]
})
export class EventListComponent implements OnInit, OnDestroy {
  events: EventDto[] = [];

  private readonly sessionTs = Date.now();

  get storeBackgroundUrl(): string | null {
    const url = this.events[0]?.storeBackgroundImageUrl;
    if (!url) return null;
    return `${url}?t=${this.sessionTs}`;
  }
  templates: EventTemplateDto[] = [];
  selectedTemplateId: number | null = null;
  private storeChangeSub!: Subscription;

  get canCreateEvent(): boolean {
    if (!this.authService.isStoreEmployee) return false;
    if (!this.authService.isAdmin) return true;
    return this.storeContext.selectedStoreId != null;
  }
  newName = '';
  newDate: Date | null = null;
  newRoundTime = 55;
  newMaxPlayers: number | null = null;
  newPointSystem: PointSystem = 'ScoreBased';

  pointSystemOptions: { value: PointSystem; label: string }[] = [
    { value: 'ScoreBased', label: POINT_SYSTEM_LABELS['ScoreBased'] },
    { value: 'WinBased', label: POINT_SYSTEM_LABELS['WinBased'] },
    { value: 'FiveOneZero', label: POINT_SYSTEM_LABELS['FiveOneZero'] },
    { value: 'SeatBased', label: POINT_SYSTEM_LABELS['SeatBased'] },
    { value: 'PointWager', label: POINT_SYSTEM_LABELS['PointWager'] },
  ];

  readonly tabs = [
    { label: 'Registration', status: 'Registration' },
    { label: 'In Progress', status: 'InProgress' },
    { label: 'Completed', status: 'Completed' }
  ];

  filteredEvents(status: string | null): EventDto[] {
    return status ? this.events.filter(e => e.status === status) : this.events;
  }

  constructor(
    private eventService: EventService,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public authService: AuthService,
    public storeContext: StoreContextService,
    private syncService: SyncService
  ) {}

  ngOnInit() {
    this.eventService.loadAllEvents();
    this.eventService.events$.subscribe(events => {
      this.events = events;
      this.cdr.detectChanges();
    });
    this.storeChangeSub = this.storeContext.selectedStoreId$.subscribe(() => {
      this.eventService.loadAllEvents();
      this.loadTemplates();
      this.cdr.detectChanges();
    });
    this.loadTemplates();
  }

  private loadTemplates(): void {
    if (!this.canCreateEvent) return;
    const storeId = this.authService.currentUser?.storeId ?? this.storeContext.selectedStoreId;
    if (!storeId) return;
    this.apiService.getEventTemplates(storeId).subscribe({
      next: templates => {
        this.templates = templates;
        this.cdr.detectChanges();
      },
      error: () => { /* non-critical */ }
    });
  }

  applyTemplate(templateId: number | null): void {
    const t = this.templates.find(x => x.id === templateId);
    if (!t) return;
    this.newName = t.name;
    this.newMaxPlayers = t.maxPlayers;
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.storeChangeSub.unsubscribe();
  }

  isOffline(evt: EventDto): boolean {
    return evt.id < 0;
  }

  syncEvent(evt: EventDto, event: MouseEvent) {
    event.stopPropagation();
    this.syncService.push().then(result => {
      if (result.errors > 0) {
        this.snackBar.open('Sync completed with errors', 'OK', { duration: 4000 });
      } else {
        this.snackBar.open('Event synced successfully', 'OK', { duration: 3000 });
      }
      this.eventService.loadAllEvents();
      this.cdr.detectChanges();
    }).catch(() => {
      this.snackBar.open('Sync failed', 'OK', { duration: 4000 });
      this.cdr.detectChanges();
    });
  }

  removeEvent(id: number, event: MouseEvent) {
    event.stopPropagation();
    this.eventService.removeEvent(id).subscribe({
      next: () => {
        this.snackBar.open('Event removed', 'OK', { duration: 3000 });
        this.eventService.loadAllEvents();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to remove event', 'OK', { duration: 3000 });
      }
    });
  }

  createEvent() {
    if (!this.newDate) return;
    const dateStr = this.newDate.toISOString().split('T')[0];
    const storeId = this.authService.currentUser?.storeId ?? this.storeContext.selectedStoreId ?? undefined;
    this.eventService.createEvent({
      name: this.newName,
      date: dateStr,
      storeId,
      defaultRoundTimeMinutes: this.newRoundTime,
      maxPlayers: this.newMaxPlayers,
      pointSystem: this.newPointSystem
    }).subscribe({
      next: () => {
        this.snackBar.open('Event created!', 'OK', { duration: 3000 });
        this.newName = '';
        this.newDate = null;
        this.newRoundTime = 55;
        this.newMaxPlayers = null;
        this.newPointSystem = 'ScoreBased';
            this.cdr.detectChanges();
        this.eventService.loadAllEvents();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to create event', 'OK', { duration: 3000 });
      }
    });
  }
}
