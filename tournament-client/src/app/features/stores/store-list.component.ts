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
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { LocalStorageContext } from '../../core/services/local-storage-context.service';
import { StoreDto } from '../../core/models/api.models';

@Component({
  selector: 'app-store-list',
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule
  ],
  template: `
    <h2>Stores</h2>

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
            <button mat-raised-button color="primary" (click)="createStore()" [disabled]="!newStoreName.trim() || !apiOnline">
              <mat-icon>add</mat-icon> Create
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    }

    @if (stores.length > 0) {
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
    } @else {
      <p class="empty-state">No stores yet.</p>
    }
  `,
  styles: [`
    .create-card { margin-bottom: 24px; }
    .table-card { margin-top: 16px; }
    .empty-state { color: #666; font-style: italic; margin-top: 16px; }
  `]
})
export class StoreListComponent implements OnInit {
  stores: StoreDto[] = [];
  newStoreName = '';
  apiOnline = true;
  readonly columns = ['storeName', 'isActive', 'actions'];

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public authService: AuthService,
    private ctx: LocalStorageContext
  ) {}

  ngOnInit() {
    this.loadStores();
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
    this.apiService.createStore({ storeName: this.newStoreName.trim() }).subscribe({
      next: store => {
        this.ctx.stores.seed([...this.ctx.stores.getAll(), store]);
        this.stores = this.ctx.stores.getAll();
        this.newStoreName = '';
        this.snackBar.open(`Store "${store.storeName}" created!`, 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to create store', 'OK', { duration: 3000 })
    });
  }
}
