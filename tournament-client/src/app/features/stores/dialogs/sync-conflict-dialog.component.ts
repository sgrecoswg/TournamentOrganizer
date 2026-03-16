import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';

export interface ConflictDialogData {
  entityType: string;
  entityId: number;
  /** Local (edited) version of the record. */
  local: Record<string, unknown>;
  /** Current server version of the record. */
  server: Record<string, unknown>;
  /** Field names that differ between local and server. */
  diffFields: string[];
}

@Component({
  selector: 'app-sync-conflict-dialog',
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatRadioModule],
  template: `
    <h2 mat-dialog-title>
      Conflict: {{ data.entityType }} #{{ data.entityId }}
    </h2>

    <mat-dialog-content>
      <p class="desc">
        This record was changed both locally and on the server.
        Choose which value to keep for each conflicting field.
      </p>

      <table class="diff-table">
        <thead>
          <tr>
            <th class="col-field">Field</th>
            <th class="col-value">Local</th>
            <th class="col-value">Server</th>
            <th class="col-pick">Keep</th>
          </tr>
        </thead>
        <tbody>
          @for (field of data.diffFields; track field) {
            <tr [class.local-row]="choices[field] === 'local'"
                [class.server-row]="choices[field] === 'server'">
              <td class="col-field">{{ field }}</td>
              <td class="col-value local-val">{{ data.local[field] }}</td>
              <td class="col-value server-val">{{ data.server[field] }}</td>
              <td class="col-pick">
                <mat-radio-group [(ngModel)]="choices[field]">
                  <mat-radio-button value="local">Local</mat-radio-button>
                  <mat-radio-button value="server">Server</mat-radio-button>
                </mat-radio-group>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel sync</button>
      <button mat-raised-button color="primary" (click)="resolve()">
        Resolve &amp; Push
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .desc { color: #666; font-size: 13px; margin: 0 0 16px; }
    .diff-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .diff-table th { text-align: left; padding: 6px 12px; border-bottom: 2px solid #e0e0e0; color: #666; font-weight: 600; }
    .diff-table td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
    .col-field  { width: 120px; font-weight: 500; }
    .col-value  { word-break: break-all; }
    .col-pick   { width: 160px; white-space: nowrap; }
    .local-val  { background: #fff8e1; }
    .server-val { background: #e8f5e9; }
    .local-row .col-field  { border-left: 3px solid #ff9800; }
    .server-row .col-field { border-left: 3px solid #4caf50; }
    mat-radio-button { margin-right: 8px; }
  `]
})
export class SyncConflictDialogComponent {
  /** Per-field choice — defaults to 'local' (keep our changes). */
  choices: Record<string, 'local' | 'server'> = {};

  constructor(
    private dialogRef: MatDialogRef<SyncConflictDialogComponent, Record<string, unknown> | null>,
    @Inject(MAT_DIALOG_DATA) public data: ConflictDialogData
  ) {
    for (const field of data.diffFields) {
      this.choices[field] = 'local';
    }
  }

  resolve(): void {
    // Build the resolved record: start with local, override chosen server fields
    const resolved: Record<string, unknown> = { ...this.data.local };
    for (const field of this.data.diffFields) {
      if (this.choices[field] === 'server') {
        resolved[field] = this.data.server[field];
      }
    }
    this.dialogRef.close(resolved);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
