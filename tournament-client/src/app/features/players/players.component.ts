import { Component, OnInit, AfterViewInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { PlayerService } from '../../core/services/player.service';
import { AuthService } from '../../core/services/auth.service';
import { PlacementBadgeComponent } from '../../shared/components/placement-badge.component';
import { RatingBadgeComponent } from '../../shared/components/rating-badge.component';
import { PlayerDto } from '../../core/models/api.models';

@Component({
  selector: 'app-players',
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule,
    MatTableModule, MatIconModule, MatSlideToggleModule, MatSnackBarModule,
    MatPaginatorModule,
    PlacementBadgeComponent, RatingBadgeComponent
  ],
  template: `
    <h2>Players</h2>

    @if (authService.isStoreEmployee) {
      <mat-card class="register-card">
        <mat-card-header>
          <mat-card-title>Register New Player</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="form-row">
            <mat-form-field>
              <mat-label>Name</mat-label>
              <input matInput [(ngModel)]="newName" placeholder="Player name">
            </mat-form-field>
            <mat-form-field>
              <mat-label>Email</mat-label>
              <input matInput [(ngModel)]="newEmail" placeholder="player@email.com" type="email">
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="register()" [disabled]="!newName || !newEmail">
              Register
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    }

    @if (dataSource.data.length > 0) {
      <mat-card class="table-card">
        <mat-card-content>
          @if (dataSource.filteredData.length === 0) {
            <p class="empty-state">No players found.</p>
          }
          <table mat-table [dataSource]="dataSource" class="full-width">
            <ng-container matColumnDef="rank">
              <th mat-header-cell *matHeaderCellDef>#</th>
              <td mat-cell *matCellDef="let row; let i = index">{{ i + 1 }}</td>
            </ng-container>
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>
                <div>Name</div>
                <mat-form-field class="filter-field" subscriptSizing="dynamic">
                  <input matInput [(ngModel)]="filterName" (ngModelChange)="applyFilter()" placeholder="Search…">
                </mat-form-field>
              </th>
              <td mat-cell *matCellDef="let row">
                @if (editingId === row.id) {
                  <mat-form-field class="inline-field">
                    <input matInput [(ngModel)]="editName">
                  </mat-form-field>
                } @else {
                  <a [routerLink]="['/players', row.id]">{{ row.name }}</a>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>
                <div>Email</div>
                <mat-form-field class="filter-field" subscriptSizing="dynamic">
                  <input matInput [(ngModel)]="filterEmail" (ngModelChange)="applyFilter()" placeholder="Search…">
                </mat-form-field>
              </th>
              <td mat-cell *matCellDef="let row">
                @if (editingId === row.id) {
                  <mat-form-field class="inline-field">
                    <input matInput [(ngModel)]="editEmail">
                  </mat-form-field>
                } @else {
                  {{ row.email }}
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="rating">
              <th mat-header-cell *matHeaderCellDef>Rating</th>
              <td mat-cell *matCellDef="let row">
                <app-rating-badge [score]="row.conservativeScore"></app-rating-badge>
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <app-placement-badge [isRanked]="row.isRanked" [gamesLeft]="row.placementGamesLeft"></app-placement-badge>
              </td>
            </ng-container>
            <ng-container matColumnDef="active">
              <th mat-header-cell *matHeaderCellDef>Active</th>
              <td mat-cell *matCellDef="let row">
                @if (authService.isStoreEmployee) {
                  <mat-slide-toggle [checked]="row.isActive" (change)="toggleActive(row)"></mat-slide-toggle>
                } @else {
                  <span>{{ row.isActive ? 'Yes' : 'No' }}</span>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let row">
                @if (authService.isStoreEmployee) {
                  @if (editingId === row.id) {
                    <button mat-icon-button color="primary" (click)="saveEdit(row)"><mat-icon>check</mat-icon></button>
                    <button mat-icon-button (click)="cancelEdit()"><mat-icon>close</mat-icon></button>
                  } @else {
                    <button mat-icon-button (click)="startEdit(row)"><mat-icon>edit</mat-icon></button>
                  }
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;" [class.inactive]="!row.isActive"></tr>
          </table>
        </mat-card-content>
        <mat-paginator [pageSize]="25" [pageSizeOptions]="[10, 25, 50, 100]"
                       aria-label="Select page of players">
        </mat-paginator>
      </mat-card>
    }
  `,
  styles: [`
    .register-card { margin-bottom: 24px; }
    .table-card { margin-top: 16px; }
    .mat-column-rank { width: 40px; color: #888; font-size: 0.85rem; }
    .inline-field { width: 150px; }
    .inactive { opacity: 0.5; }
    .filter-field { width: 120px; font-size: 0.8rem; }
    .empty-state { padding: 16px; color: #888; }
  `]
})
export class PlayersComponent implements OnInit, AfterViewInit {
  newName = '';
  newEmail = '';
  dataSource = new MatTableDataSource<PlayerDto>();
  readonly columns = ['rank', 'name', 'email', 'rating', 'status', 'active', 'actions'];

  filterName  = '';
  filterEmail = '';

  editingId: number | null = null;
  editName = '';
  editEmail = '';

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private playerService: PlayerService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.playerService.loadAllPlayers();
    this.playerService.players$.subscribe(p => {
      this.dataSource.data = [...p].sort((a, b) => {
        if (a.isRanked !== b.isRanked) return a.isRanked ? -1 : 1;
        if (a.isRanked) return b.conservativeScore - a.conservativeScore;
        return a.placementGamesLeft - b.placementGamesLeft;
      });
      // detectChanges first so @if renders the paginator into the DOM
      this.cdr.detectChanges();
      // Wire paginator after the @if block has rendered it
      if (this.paginator && !this.dataSource.paginator) {
        this.dataSource.paginator = this.paginator;
      }
    });
  }

  ngAfterViewInit() {
    this.dataSource.filterPredicate = (row, filter) => {
      const f = JSON.parse(filter) as { name: string; email: string };
      return row.name.toLowerCase().includes(f.name)
          && row.email.toLowerCase().includes(f.email);
    };
    this.cdr.detectChanges();
  }

  applyFilter() {
    this.dataSource.filter = JSON.stringify({
      name:  this.filterName.toLowerCase(),
      email: this.filterEmail.toLowerCase(),
    });
    this.cdr.detectChanges();
  }

  register() {
    this.playerService.registerPlayer({ name: this.newName, email: this.newEmail }).subscribe({
      next: (player) => {
        this.snackBar.open(`${player.name} registered!`, 'OK', { duration: 3000 });
        this.newName = '';
        this.newEmail = '';
        this.cdr.detectChanges();
        this.playerService.loadAllPlayers();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Registration failed', 'OK', { duration: 3000 });
      }
    });
  }

  startEdit(player: PlayerDto) {
    this.editingId = player.id;
    this.editName = player.name;
    this.editEmail = player.email;
    this.cdr.detectChanges();
  }

  cancelEdit() {
    this.editingId = null;
    this.cdr.detectChanges();
  }

  saveEdit(player: PlayerDto) {
    this.playerService.updatePlayer(player.id, {
      name: this.editName,
      email: this.editEmail,
      isActive: player.isActive
    }).subscribe({
      next: () => {
        this.snackBar.open('Player updated!', 'OK', { duration: 3000 });
        this.editingId = null;
        this.cdr.detectChanges();
        this.playerService.loadAllPlayers();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Update failed', 'OK', { duration: 3000 });
      }
    });
  }

  toggleActive(player: PlayerDto) {
    this.playerService.updatePlayer(player.id, {
      name: player.name,
      email: player.email,
      isActive: !player.isActive
    }).subscribe({
      next: () => {
        this.snackBar.open(`Player ${!player.isActive ? 'activated' : 'deactivated'}`, 'OK', { duration: 3000 });
        this.playerService.loadAllPlayers();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Update failed', 'OK', { duration: 3000 });
      }
    });
  }
}
