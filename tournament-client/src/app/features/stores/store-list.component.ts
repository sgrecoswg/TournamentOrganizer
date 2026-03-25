import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { LocalStorageContext } from '../../core/services/local-storage-context.service';
import { LicenseTier, StoreDto, StoreGroupDto } from '../../core/models/api.models';

@Component({
  selector: 'app-store-list',
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule, MatChipsModule,
    MatSelectModule
  ],
  template: `
    <h2>Stores</h2>

    @if (authService.isAdmin) {
      <div class="admin-actions">
        <a mat-stroked-button routerLink="/store-groups">
          <mat-icon>store</mat-icon> Manage Store Groups
        </a>
      </div>
    }

    @if (authService.isAdmin) {
      <mat-card class="create-card">
        <mat-card-header>
          <mat-card-title>New Store</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="form-row">
            <mat-form-field>
              <mat-label>Store Name</mat-label>
              <input matInput [(ngModel)]="newStoreName" placeholder="e.g. Downtown Game Shop">
            </mat-form-field>
            @if (storeGroups.length > 0) {
              <mat-form-field>
                <mat-label>Store Group (optional)</mat-label>
                <mat-select [(ngModel)]="newStoreGroupId" data-create-group-select>
                  <mat-option [value]="null">— None —</mat-option>
                  @for (group of storeGroups; track group.id) {
                    <mat-option [value]="group.id">{{ group.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
            <button mat-raised-button color="primary" (click)="createStore()" [disabled]="!newStoreName.trim() || !apiOnline">
              <mat-icon>add</mat-icon> Create
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    }

    @if (stores.length > 0) {
      @if (authService.isAdmin) {
        @for (group of uniqueGroups; track group.id) {
          <div class="group-header">
            <mat-icon>store</mat-icon>
            <span>{{ group.name }}</span>
          </div>
          <mat-card class="table-card">
            <mat-card-content>
              <table mat-table [dataSource]="storesByGroup(group.id)" class="full-width">
                <ng-container matColumnDef="storeName">
                  <th mat-header-cell *matHeaderCellDef>Name</th>
                  <td mat-cell *matCellDef="let row">
                    <a [routerLink]="['/stores', row.id]">{{ row.storeName }}</a>
                  </td>
                </ng-container>
                <ng-container matColumnDef="isActive">
                  <th mat-header-cell *matHeaderCellDef>Active</th>
                  <td mat-cell *matCellDef="let row">
                    @if (row.isActive) {
                      <mat-icon color="primary">check_circle</mat-icon>
                    } @else {
                      <mat-icon>cancel</mat-icon>
                    }
                  </td>
                </ng-container>
                <ng-container matColumnDef="tier">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let row">
                    <mat-chip class="tier-badge" [color]="tierColor(row.tier)" highlighted>
                      {{ tierLabel(row.tier) }}
                    </mat-chip>
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let row">
                    <button mat-icon-button [routerLink]="['/stores', row.id]">
                      <mat-icon>settings</mat-icon>
                    </button>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="columns"></tr>
                <tr mat-row *matRowDef="let row; columns: columns;"></tr>
              </table>
            </mat-card-content>
          </mat-card>
        }
        @if (ungroupedStores.length > 0) {
          <div class="ungrouped-section">
            <div class="group-header ungrouped-header">
              <mat-icon>storefront</mat-icon>
              <span>Ungrouped</span>
            </div>
            <mat-card class="table-card">
              <mat-card-content>
                <table mat-table [dataSource]="ungroupedStores" class="full-width">
                  <ng-container matColumnDef="storeName">
                    <th mat-header-cell *matHeaderCellDef>Name</th>
                    <td mat-cell *matCellDef="let row">
                      <a [routerLink]="['/stores', row.id]">{{ row.storeName }}</a>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="isActive">
                    <th mat-header-cell *matHeaderCellDef>Active</th>
                    <td mat-cell *matCellDef="let row">
                      @if (row.isActive) {
                        <mat-icon color="primary">check_circle</mat-icon>
                      } @else {
                        <mat-icon>cancel</mat-icon>
                      }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="tier">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let row">
                      <mat-chip class="tier-badge" [color]="tierColor(row.tier)" highlighted>
                        {{ tierLabel(row.tier) }}
                      </mat-chip>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let row">
                      <button mat-icon-button [routerLink]="['/stores', row.id]">
                        <mat-icon>settings</mat-icon>
                      </button>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="columns"></tr>
                  <tr mat-row *matRowDef="let row; columns: columns;"></tr>
                </table>
              </mat-card-content>
            </mat-card>
          </div>
        }
      } @else {
        <mat-card class="table-card">
          <mat-card-content>
            <table mat-table [dataSource]="stores" class="full-width">
              <ng-container matColumnDef="storeName">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let row">
                  <a [routerLink]="['/stores', row.id]">{{ row.storeName }}</a>
                </td>
              </ng-container>
              <ng-container matColumnDef="isActive">
                <th mat-header-cell *matHeaderCellDef>Active</th>
                <td mat-cell *matCellDef="let row">
                  @if (row.isActive) {
                    <mat-icon color="primary">check_circle</mat-icon>
                  } @else {
                    <mat-icon>cancel</mat-icon>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="tier">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let row">
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let row">
                  <button mat-icon-button [routerLink]="['/stores', row.id]">
                    <mat-icon>settings</mat-icon>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      }
    } @else {
      <p class="empty-state">No stores yet.</p>
    }
  `,
  styles: [`
    .admin-actions { margin-bottom: 16px; }
    .create-card { margin-bottom: 24px; }
    .table-card { margin-top: 16px; }
    .empty-state { color: #666; font-style: italic; margin-top: 16px; }
    .group-header { display: flex; align-items: center; gap: 8px; padding: 12px 0 4px; font-weight: 600; font-size: 1rem; }
    .ungrouped-section { margin-top: 16px; }
  `]
})
export class StoreListComponent implements OnInit {
  stores: StoreDto[] = [];
  storeGroups: StoreGroupDto[] = [];
  newStoreName = '';
  newStoreGroupId: number | null = null;
  apiOnline = true;
  readonly columns = ['storeName', 'isActive', 'tier', 'actions'];

  get uniqueGroups(): { id: number; name: string }[] {
    const seen = new Map<number, string>();
    for (const s of this.stores) {
      if (s.storeGroupId != null && s.storeGroupName && !seen.has(s.storeGroupId)) {
        seen.set(s.storeGroupId, s.storeGroupName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }

  storesByGroup(groupId: number): StoreDto[] {
    return this.stores.filter(s => s.storeGroupId === groupId);
  }

  get ungroupedStores(): StoreDto[] {
    return this.stores.filter(s => s.storeGroupId == null);
  }

  tierLabel(tier: LicenseTier | null | undefined): string {
    switch (tier) {
      case 'Tier1': return 'Tier 1';
      case 'Tier2': return 'Tier 2';
      default:      return 'Free';
    }
  }

  tierColor(tier: LicenseTier | null | undefined): string {
    switch (tier) {
      case 'Tier1': return 'primary';
      case 'Tier2': return 'accent';
      default:      return '';
    }
  }

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public authService: AuthService,
    private ctx: LocalStorageContext
  ) {}

  ngOnInit() {
    this.loadStores();
    if (this.authService.isAdmin) {
      this.apiService.getStoreGroups().subscribe({
        next: groups => { this.storeGroups = groups; this.cdr.detectChanges(); },
        error: () => {}
      });
    }
  }

  private loadStores() {
    // Show cached stores immediately so the page renders offline
    const cached = this.ctx.stores.getAll();
    if (cached.length > 0) {
      this.stores = cached;
      this.cdr.detectChanges();
    }
    // Always attempt a refresh; silently skip on network failure
    this.apiService.getStores().subscribe({
      next: stores => {
        this.apiOnline = true;
        this.ctx.stores.seed(stores);
        this.stores = this.ctx.stores.getAll();
        this.cdr.detectChanges();
      },
      error: () => {
        this.apiOnline = false;
        this.cdr.detectChanges();
        if (cached.length === 0) {
          this.snackBar.open('Could not load stores — offline', 'OK', { duration: 3000 });
        }
      }
    });
  }

  createStore() {
    if (!this.newStoreName.trim()) return;
    this.apiService.createStore({ storeName: this.newStoreName.trim(), storeGroupId: this.newStoreGroupId }).subscribe({
      next: store => {
        this.ctx.stores.seed([...this.ctx.stores.getAll(), store]);
        this.stores = this.ctx.stores.getAll();
        this.newStoreName = '';
        this.newStoreGroupId = null;
        this.snackBar.open(`Store "${store.storeName}" created!`, 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to create store', 'OK', { duration: 3000 })
    });
  }
}
