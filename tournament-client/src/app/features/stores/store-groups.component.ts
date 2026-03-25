import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { StoreDto, StoreGroupDto } from '../../core/models/api.models';

@Component({
  selector: 'app-store-groups',
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule,
    MatSelectModule, MatTableModule,
  ],
  template: `
    <h2>Store Groups</h2>

    <div class="actions-row">
      <button mat-raised-button color="primary" (click)="showCreateForm = true" [disabled]="showCreateForm">
        <mat-icon>add</mat-icon> New Group
      </button>
      <a mat-button routerLink="/stores">
        <mat-icon>arrow_back</mat-icon> Back to Stores
      </a>
    </div>

    @if (showCreateForm) {
      <mat-card class="create-group-form">
        <mat-card-header>
          <mat-card-title>Create Group</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field>
            <mat-label>Group Name</mat-label>
            <input matInput [(ngModel)]="newGroupName" placeholder="e.g. Top Deck Chain">
          </mat-form-field>
        </mat-card-content>
        <mat-card-actions>
          <button mat-raised-button color="primary" (click)="createGroup()" [disabled]="!newGroupName.trim()">
            <mat-icon>save</mat-icon> Save
          </button>
          <button mat-button (click)="showCreateForm = false; newGroupName = ''">Cancel</button>
        </mat-card-actions>
      </mat-card>
    }

    @if (groups.length > 0) {
      @for (group of groups; track group.id) {
        <mat-card class="group-card">
          <mat-card-header>
            <mat-card-title>{{ group.name }}</mat-card-title>
            <mat-card-subtitle>{{ group.storeCount }} store(s)</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @if (assigningGroupId === group.id) {
              <div class="assign-row">
                <mat-form-field>
                  <mat-label>Store</mat-label>
                  <mat-select [(ngModel)]="assignStoreId" data-assign-select>
                    @for (store of unassignedStores; track store.id) {
                      <mat-option [value]="store.id">{{ store.storeName }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-raised-button color="primary" (click)="confirmAssign(group.id)" [disabled]="!assignStoreId">
                  Confirm
                </button>
                <button mat-button (click)="assigningGroupId = null; assignStoreId = null">Cancel</button>
              </div>
            }
          </mat-card-content>
          <mat-card-actions>
            <button mat-button [attr.data-group-id]="group.id" (click)="openAssign(group.id)">
              <mat-icon>add_business</mat-icon> Assign Store
            </button>
            <button mat-button color="warn" (click)="deleteGroup(group.id)">
              <mat-icon>delete</mat-icon> Delete
            </button>
          </mat-card-actions>
        </mat-card>
      }
    } @else {
      <p class="empty-state">No store groups yet.</p>
    }
  `,
  styles: [`
    .actions-row { display: flex; gap: 8px; margin-bottom: 16px; }
    .create-group-form { margin-bottom: 16px; }
    .group-card { margin-bottom: 16px; }
    .assign-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .empty-state { color: #666; font-style: italic; margin-top: 16px; }
  `]
})
export class StoreGroupsComponent implements OnInit {
  groups: StoreGroupDto[] = [];
  allStores: StoreDto[] = [];
  showCreateForm = false;
  newGroupName = '';
  assigningGroupId: number | null = null;
  assignStoreId: number | null = null;

  get unassignedStores(): StoreDto[] {
    return this.allStores.filter(s => s.storeGroupId == null);
  }

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.loadGroups();
    this.loadStores();
  }

  private loadGroups() {
    this.apiService.getStoreGroups().subscribe({
      next: groups => {
        this.groups = groups;
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to load store groups', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  private loadStores() {
    this.apiService.getStores().subscribe({
      next: stores => {
        this.allStores = stores;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  createGroup() {
    if (!this.newGroupName.trim()) return;
    this.apiService.createStoreGroup({ name: this.newGroupName.trim() }).subscribe({
      next: group => {
        this.groups = [...this.groups, group];
        this.newGroupName = '';
        this.showCreateForm = false;
        this.snackBar.open(`Group "${group.name}" created`, 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to create group', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  deleteGroup(id: number) {
    this.apiService.deleteStoreGroup(id).subscribe({
      next: () => {
        this.groups = this.groups.filter(g => g.id !== id);
        this.snackBar.open('Group deleted', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to delete group', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  openAssign(groupId: number) {
    this.assigningGroupId = groupId;
    this.assignStoreId = null;
    this.cdr.detectChanges();
  }

  confirmAssign(groupId: number) {
    if (!this.assignStoreId) return;
    const storeId = this.assignStoreId;
    this.apiService.assignStoreToGroup(groupId, storeId).subscribe({
      next: () => {
        const store = this.allStores.find(s => s.id === storeId);
        if (store) store.storeGroupId = groupId;
        this.assigningGroupId = null;
        this.assignStoreId = null;
        const group = this.groups.find(g => g.id === groupId);
        if (group) group.storeCount++;
        this.snackBar.open('Store assigned to group', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Failed to assign store', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }
}
