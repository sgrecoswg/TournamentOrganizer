import { Component, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { LocalStorageContext } from '../../../core/services/local-storage-context.service';
import { ApiService } from '../../../core/services/api.service';
import {
  BulkRegisterConfirmDto,
  BulkRegisterFoundDto,
  BulkRegisterPreviewDto,
  BulkRegisterResultDto,
  PlayerDto,
} from '../../../core/models/api.models';

export interface BulkRegisterDialogData {
  eventId: number;
  availableSlots: number;
  registeredPlayerIds: Set<number>;
}

@Component({
  selector: 'app-bulk-register-dialog',
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatCheckboxModule, MatDialogModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatListModule,
  ],
  template: `
    <h2 mat-dialog-title>Bulk Register Players</h2>

    <mat-dialog-content>
      @if (!showPreview) {
        <!-- File upload -->
        <div class="bulk-upload-row">
          <button mat-stroked-button (click)="fileInput.click()">
            <mat-icon>upload_file</mat-icon> Upload File
          </button>
          <input #fileInput type="file" accept=".txt,.csv"
                 style="display:none"
                 (change)="onFileSelected($event)">
          <span class="upload-hint">CSV or TXT — one email per line</span>
        </div>

        <!-- Multi-select -->
        <div class="bulk-multiselect">
          <div class="bulk-filter-row">
            <mat-form-field class="bulk-filter-field">
              <mat-label>Filter Players</mat-label>
              <input matInput [(ngModel)]="playerFilterText" (ngModelChange)="cdr.detectChanges()">
            </mat-form-field>
            <button mat-button (click)="toggleSelectAll(true)">Select All</button>
            <button mat-button (click)="toggleSelectAll(false)">Deselect All</button>
          </div>
          <mat-selection-list>
            @for (p of filteredPool; track p.id) {
              <mat-list-option
                [selected]="selectedPlayerIds.has(p.id)"
                (selectedChange)="$event ? selectedPlayerIds.add(p.id) : selectedPlayerIds.delete(p.id); cdr.detectChanges()">
                {{ p.name }} — {{ p.email }}
              </mat-list-option>
            }
          </mat-selection-list>
        </div>
      }

      @if (showPreview && previewData) {
        <div class="bulk-preview-panel">
          <h3>Preview Registration</h3>

          @if (previewData.found.length > 0) {
            <p><strong>Will register ({{ previewData.found.length }}):</strong></p>
            @for (f of previewData.found; track f.playerId) {
              <div class="preview-row">
                <mat-checkbox [(ngModel)]="previewSelected[f.playerId]" (ngModelChange)="cdr.detectChanges()">
                  {{ f.name }} — {{ f.email }}
                </mat-checkbox>
              </div>
            }
          }

          @if (previewData.notFound.length > 0) {
            <p><strong>New players to create ({{ previewData.notFound.length }}):</strong></p>
            @for (email of previewData.notFound; track email) {
              <div class="preview-row">
                <mat-checkbox [(ngModel)]="unknownIncluded[email]" (ngModelChange)="cdr.detectChanges()">
                  {{ email }}
                </mat-checkbox>
                <mat-form-field class="name-field">
                  <mat-label>Name for {{ email }}</mat-label>
                  <input matInput [(ngModel)]="unknownNames[email]">
                </mat-form-field>
              </div>
            }
          }

          @if (previewData.alreadyRegistered.length > 0) {
            <p><strong>Already registered (skipped):</strong>
              @for (a of previewData.alreadyRegistered; track a.playerId) {
                <span> {{ a.email }}</span>
              }
            </p>
          }

          @if (previewOverCapacity) {
            <p class="capacity-warning">
              <mat-icon>warning</mat-icon>
              Selection exceeds available slots ({{ data.availableSlots }} remaining). Deselect some players to continue.
            </p>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (!showPreview) {
        <button mat-button (click)="cancel()">Cancel</button>
        <button mat-raised-button color="primary"
                [disabled]="selectedPlayerIds.size === 0"
                (click)="onRegisterSelected()">
          Preview Registration
        </button>
      } @else {
        <button mat-button (click)="cancelPreview()">Back</button>
        <button mat-raised-button color="primary"
                [disabled]="previewOverCapacity"
                (click)="confirm()">
          Confirm Registration
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 480px; max-width: 640px; max-height: 60vh; }
    .bulk-upload-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .upload-hint { color: #888; font-size: 0.82rem; }
    .bulk-filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .bulk-filter-field { flex: 1; min-width: 180px; }
    .preview-row { display: flex; align-items: center; gap: 12px; margin: 4px 0; }
    .name-field { flex: 1; }
    .capacity-warning { display: flex; align-items: center; gap: 6px; color: #c62828; font-weight: 500; margin: 8px 0; }
    .capacity-warning mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `],
})
export class BulkRegisterDialogComponent {
  storePlayerPool: PlayerDto[];
  selectedPlayerIds = new Set<number>();
  playerFilterText = '';

  showPreview = false;
  previewData: BulkRegisterPreviewDto | null = null;
  previewSelected: Record<number, boolean> = {};
  unknownNames: Record<string, string> = {};
  unknownIncluded: Record<string, boolean> = {};

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: BulkRegisterDialogData,
    private dialogRef: MatDialogRef<BulkRegisterDialogComponent, BulkRegisterResultDto | undefined>,
    private api: ApiService,
    private ctx: LocalStorageContext,
    public cdr: ChangeDetectorRef,
  ) {
    this.storePlayerPool = this.ctx.players.getAll();
  }

  get filteredPool(): PlayerDto[] {
    const s = this.playerFilterText.toLowerCase();
    return this.storePlayerPool.filter(p =>
      p.name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s),
    );
  }

  get previewOverCapacity(): boolean {
    if (!this.previewData) return false;
    const willRegister =
      this.previewData.found.filter(f => this.previewSelected[f.playerId]).length +
      this.previewData.notFound.filter(e => this.unknownIncluded[e]).length;
    return willRegister > this.data.availableSlots;
  }

  toggleSelectAll(select: boolean): void {
    if (select) {
      this.filteredPool.forEach(p => this.selectedPlayerIds.add(p.id));
    } else {
      this.selectedPlayerIds.clear();
    }
    this.cdr.detectChanges();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = (reader.result as string)
        .split('\n')
        .map(l => l.trim().toLowerCase())
        .filter(l => l.length > 0 && l !== 'email');

      const all = this.ctx.players.getAll();
      const found: BulkRegisterFoundDto[] = [];
      const notFound: string[] = [];
      const alreadyRegistered: BulkRegisterFoundDto[] = [];

      for (const email of lines) {
        const player = all.find(p => p.email.toLowerCase() === email);
        if (!player) {
          notFound.push(email);
        } else if (this.data.registeredPlayerIds.has(player.id)) {
          alreadyRegistered.push({ playerId: player.id, name: player.name, email: player.email });
        } else {
          found.push({ playerId: player.id, name: player.name, email: player.email });
        }
      }

      this.previewData     = { found, notFound, alreadyRegistered };
      this.previewSelected = Object.fromEntries(found.map(f => [f.playerId, true]));
      this.unknownNames    = Object.fromEntries(notFound.map(e => [e, '']));
      this.unknownIncluded = Object.fromEntries(notFound.map(e => [e, true]));
      this.showPreview     = true;
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
  }

  onRegisterSelected(): void {
    const found: BulkRegisterFoundDto[] = [];
    const alreadyRegistered: BulkRegisterFoundDto[] = [];
    for (const id of this.selectedPlayerIds) {
      const player = this.ctx.players.getById(id);
      if (!player) continue;
      if (this.data.registeredPlayerIds.has(id)) {
        alreadyRegistered.push({ playerId: id, name: player.name, email: player.email });
      } else {
        found.push({ playerId: id, name: player.name, email: player.email });
      }
    }
    this.previewData     = { found, notFound: [], alreadyRegistered };
    this.previewSelected = Object.fromEntries(found.map(f => [f.playerId, true]));
    this.showPreview     = true;
    this.cdr.detectChanges();
  }

  confirm(): void {
    if (!this.previewData || this.previewOverCapacity) return;
    const registrations: BulkRegisterConfirmDto['registrations'] = [
      ...this.previewData.found
        .filter(f => this.previewSelected[f.playerId])
        .map(f => ({ playerId: f.playerId, email: f.email })),
      ...this.previewData.notFound
        .filter(e => this.unknownIncluded[e])
        .map(e => ({ playerId: null, email: e, name: this.unknownNames[e] || null })),
    ];
    this.api.bulkRegisterConfirm(this.data.eventId, { registrations }).subscribe({
      next: result => {
        this.dialogRef.close(result);
      },
      error: () => {
        this.dialogRef.close(undefined);
      },
    });
  }

  cancelPreview(): void {
    this.showPreview  = false;
    this.previewData  = null;
    this.cdr.detectChanges();
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
