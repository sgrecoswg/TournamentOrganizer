import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SyncService } from '../../core/services/sync.service';
import { LocalStorageContext } from '../../core/services/local-storage-context.service';
import { StorageAdapter } from '../../core/services/storage-adapter.service';
import { ThemeService } from '../../core/services/theme.service';
import { StoreDetailDto, AppUserDto, LicenseDto, ThemeDto, EventTemplateDto, CreateEventTemplateDto } from '../../core/models/api.models';
import { StoreContextService } from '../../core/services/store-context.service';
import { ConfirmDialogComponent } from './dialogs/confirm-dialog.component';
import { TierUpgradePromptComponent } from '../../shared/components/tier-upgrade-prompt.component';
import { StoreAnalyticsComponent } from './store-analytics.component';
import { MatChipsModule } from '@angular/material/chips';

function getUploadErrorMessage(err: HttpErrorResponse, fallback: string): string {
  if (err.status === 400 && typeof err.error === 'string' && err.error.trim()) {
    return err.error.trim();
  }
  return fallback;
}

@Component({
  selector: 'app-store-detail',
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule,
    MatTabsModule, MatTableModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, MatSlideToggleModule,
    MatDialogModule, MatDividerModule, MatChipsModule,
    TierUpgradePromptComponent,
    StoreAnalyticsComponent,
  ],
  template: `
    <div class="page-header">
      <button mat-icon-button [routerLink]="['/stores']">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <h2>{{ store?.storeName ?? 'Store Settings' }}</h2>
      @if (authService.isStoreEmployee) {
        <button mat-stroked-button [routerLink]="['/stores', storeId, 'meta']" style="margin-left:auto">
          <mat-icon>bar_chart</mat-icon> Meta Report
        </button>
      }
      @if (authService.isStoreManager && store?.slug) {
        <a mat-stroked-button [routerLink]="['/stores/public', store!.slug]" target="_blank" style="margin-left:8px" data-testid="public-page-link">
          <mat-icon>open_in_new</mat-icon> Public Page
        </a>
      }
    </div>

    @if (store) {
      <!-- ── Logo ──────────────────────────────────────────────── -->
      <div class="logo-section">
        @if (store.logoUrl) {
          <img class="store-logo" [src]="store.logoUrl" [alt]="store.storeName">
        } @else {
          <mat-icon class="store-logo-placeholder">store</mat-icon>
        }
        @if (authService.isStoreEmployee && authService.isTier1) {
          <button mat-stroked-button (click)="logoInput.click()" data-testid="upload-logo-btn">
            <mat-icon>upload</mat-icon> Change Logo
          </button>
          <input #logoInput type="file" accept=".png,.jpg,.jpeg,.gif"
                 style="display:none"
                 (change)="onLogoSelected($event)">
        } @else if (authService.isStoreEmployee && !authService.isTier1) {
          <app-tier-upgrade-prompt feature="Logo upload" requiredTier="Tier 1"></app-tier-upgrade-prompt>
        }
      </div>

      @if (license?.isInTrial && (authService.isStoreManager || authService.isAdmin)) {
        <div class="trial-banner" data-testid="trial-badge">
          <mat-icon>science</mat-icon>
          Trial — {{ trialDaysRemaining }} day{{ trialDaysRemaining === 1 ? '' : 's' }} remaining.
          Contact your administrator to upgrade.
        </div>
      }
      @if (daysUntilExpiry !== null && daysUntilExpiry <= EXPIRY_WARN_DAYS
           && (authService.isStoreManager || authService.isAdmin)) {
        <div class="expiry-banner" [class.expiry-critical]="daysUntilExpiry <= 7">
          <mat-icon>warning</mat-icon>
          @if (daysUntilExpiry > 0) {
            Your license expires in {{ daysUntilExpiry }} day{{ daysUntilExpiry === 1 ? '' : 's' }}.
            Contact your administrator to renew.
          } @else {
            Your license has expired. Contact your administrator to renew.
          }
        </div>
      }
      @if (isInGracePeriod && (authService.isStoreManager || authService.isAdmin)) {
        <div class="grace-warning" data-testid="grace-warning">
          <mat-icon>warning</mat-icon>
          License expired. Grace period ends {{ gracePeriodEndsDate | date:'mediumDate' }}.
          Renew now to avoid losing access.
        </div>
      }

      <mat-tab-group>

        <!-- ── Tab 1: Settings ───────────────────────────────── -->
        <mat-tab label="Settings">
          <div class="tab-content">
            <mat-card class="settings-card">
              <mat-card-header>
                <mat-card-title>Store Details</mat-card-title>
                <mat-card-subtitle>{{ store.isActive ? 'Active' : 'Inactive' }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="form-column">
                  <mat-form-field>
                    <mat-label>Store Name</mat-label>
                    <input matInput [(ngModel)]="editStoreName" [readonly]="!authService.isStoreManager">
                  </mat-form-field>
                  <mat-form-field>
                    <mat-label>Allowable Trade Differential (%)</mat-label>
                    <input matInput type="number" [(ngModel)]="editDifferential"
                           min="0" max="100" step="1" [readonly]="!authService.isStoreManager">
                    <span matSuffix>%</span>
                  </mat-form-field>
                  @if (authService.isStoreManager) {
                    @if (store.slug) {
                      <mat-form-field>
                        <mat-label>Your Public Page URL</mat-label>
                        <input matInput [value]="publicPageUrl" readonly>
                        <button matSuffix mat-icon-button (click)="copyPublicUrl()" aria-label="Copy URL">
                          <mat-icon>content_copy</mat-icon>
                        </button>
                        <mat-hint>Share this link so players can find your events without logging in.</mat-hint>
                      </mat-form-field>
                    }
                    <mat-form-field>
                      <mat-label>Theme</mat-label>
                      <mat-select [(ngModel)]="selectedThemeId" (ngModelChange)="previewTheme($event)"
                                  data-testid="theme-select">
                        @for (t of themes; track t.id) {
                          <mat-option [value]="t.id">{{ t.name }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field>
                      <mat-label>Discord Webhook URL</mat-label>
                      <input matInput
                             type="password"
                             placeholder="https://discord.com/api/webhooks/..."
                             [(ngModel)]="editDiscordWebhookUrl"
                             autocomplete="off"
                             aria-label="Discord Webhook URL" />
                      <mat-hint>
                        @if (store.hasDiscordWebhook) {
                          <span class="discord-connected"><mat-icon>check_circle</mat-icon> Connected</span>
                        } @else {
                          Not connected
                        }
                      </mat-hint>
                    </mat-form-field>
                    <mat-form-field>
                      <mat-label>Seller Portal URL</mat-label>
                      <input matInput
                             type="url"
                             placeholder="https://store.tcgplayer.com/..."
                             [(ngModel)]="editSellerPortalUrl"
                             autocomplete="off"
                             aria-label="Seller Portal URL" />
                      <mat-hint>Optional. Used as the buy link on card previews. Use &#123;q&#125; as a placeholder for the card name.</mat-hint>
                    </mat-form-field>
                    <div class="background-section">
                      @if (store.backgroundImageUrl) {
                        <img class="background-preview" [src]="store.backgroundImageUrl" alt="Page background">
                      }
                      <button mat-stroked-button (click)="bgInput.click()">
                        <mat-icon>wallpaper</mat-icon>
                        {{ store.backgroundImageUrl ? 'Change Background' : 'Upload Background' }}
                      </button>
                      <input #bgInput type="file" accept=".png,.jpg,.jpeg"
                             style="display:none"
                             (change)="onBackgroundSelected($event)">
                    </div>
                  }
                </div>
              </mat-card-content>
              @if (authService.isStoreManager && authService.isTier1) {
                <mat-card-actions>
                  <button mat-raised-button color="primary" (click)="save()" [disabled]="!editStoreName.trim()">
                    <mat-icon>save</mat-icon> Save
                  </button>
                  @if (store.hasDiscordWebhook) {
                    <button mat-stroked-button (click)="testWebhook()">
                      <mat-icon>send</mat-icon> Test Webhook
                    </button>
                  }
                  <button mat-button [routerLink]="['/stores']">Cancel</button>
                </mat-card-actions>
              }
            </mat-card>
          </div>
        </mat-tab>

        <!-- ── Tab 2: Employees (StoreManager+) ─────────────── -->
        @if (authService.isStoreManager) {
          <mat-tab label="Employees">
            <div class="tab-content">

              <!-- Add Employee form -->
              <mat-card class="add-card">
                <mat-card-header><mat-card-title>Add Employee</mat-card-title></mat-card-header>
                <mat-card-content>
                  <div class="form-row">
                    <mat-form-field class="name-field">
                      <mat-label>Name</mat-label>
                      <input matInput [(ngModel)]="newEmployeeName" placeholder="Jane Smith">
                    </mat-form-field>
                    <mat-form-field class="email-field">
                      <mat-label>Email</mat-label>
                      <input matInput [(ngModel)]="newEmployeeEmail" placeholder="user@example.com">
                    </mat-form-field>
                    <mat-form-field>
                      <mat-label>Role</mat-label>
                      <mat-select [(ngModel)]="newEmployeeRole">
                        <mat-option value="StoreEmployee">Store Employee</mat-option>
                        <mat-option value="StoreManager">Store Manager</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <button mat-raised-button color="primary"
                            (click)="addEmployee()"
                            [disabled]="!newEmployeeEmail.trim()">
                      <mat-icon>person_add</mat-icon> Add
                    </button>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Employee table -->
              @if (employees.length > 0) {
                <mat-card class="table-card">
                  <mat-card-content>
                    <table mat-table [dataSource]="employees" class="full-width">
                      <ng-container matColumnDef="name">
                        <th mat-header-cell *matHeaderCellDef>Name</th>
                        <td mat-cell *matCellDef="let row">{{ row.name }}</td>
                      </ng-container>
                      <ng-container matColumnDef="email">
                        <th mat-header-cell *matHeaderCellDef>Email</th>
                        <td mat-cell *matCellDef="let row">{{ row.email }}</td>
                      </ng-container>
                      <ng-container matColumnDef="role">
                        <th mat-header-cell *matHeaderCellDef>Role</th>
                        <td mat-cell *matCellDef="let row">{{ row.role }}</td>
                      </ng-container>
                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef></th>
                        <td mat-cell *matCellDef="let row">
                          <button mat-icon-button color="warn" (click)="removeEmployee(row.id)"
                                  [disabled]="row.id === authService.currentUser?.playerId">
                            <mat-icon>person_remove</mat-icon>
                          </button>
                        </td>
                      </ng-container>
                      <tr mat-header-row *matHeaderRowDef="employeeCols"></tr>
                      <tr mat-row *matRowDef="let row; columns: employeeCols;"></tr>
                    </table>
                  </mat-card-content>
                </mat-card>
              } @else {
                <p class="empty-state">No employees assigned to this store.</p>
              }
            </div>
          </mat-tab>
        }

        <!-- ── Tab 3: License (StoreManager+) ───────────────── -->
        @if (authService.isStoreManager || authService.isAdmin) {
          <mat-tab label="License">
            <div class="tab-content">
              @if (license) {
                <mat-card class="settings-card">
                  <mat-card-header>
                    <mat-card-title>License Details</mat-card-title>
                    <mat-card-subtitle>
                      {{ license.isActive ? 'Active' : 'Inactive' }}
                    </mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content>
                    @if (daysUntilExpiry !== null && daysUntilExpiry <= 30) {
                      <div class="expiry-warning" data-testid="expiry-warning">
                        <mat-icon>warning</mat-icon>
                        License expires in {{ daysUntilExpiry }} days
                      </div>
                    }
                    <div class="form-column">
                      @if (!authService.isAdmin) {
                        <div class="tier-chip-row">
                          <span class="tier-label">Tier:</span>
                          <mat-chip-set>
                            <mat-chip data-testid="tier-chip">{{ license.tier }}</mat-chip>
                          </mat-chip-set>
                        </div>
                      }
                      <mat-form-field>
                        <mat-label>App Key</mat-label>
                        <input matInput [(ngModel)]="editLicenseKey" [readonly]="!authService.isAdmin">
                      </mat-form-field>
                      <mat-form-field>
                        <mat-label>Available Date</mat-label>
                        <input matInput [matDatepicker]="availPicker" [(ngModel)]="editAvailableDate"
                               [readonly]="!authService.isAdmin">
                        @if (authService.isAdmin) {
                          <mat-datepicker-toggle matIconSuffix [for]="availPicker"></mat-datepicker-toggle>
                        }
                        <mat-datepicker #availPicker></mat-datepicker>
                      </mat-form-field>
                      <mat-form-field>
                        <mat-label>Expires Date</mat-label>
                        <input matInput [matDatepicker]="expPicker" [(ngModel)]="editExpiresDate"
                               [readonly]="!authService.isAdmin">
                        @if (authService.isAdmin) {
                          <mat-datepicker-toggle matIconSuffix [for]="expPicker"></mat-datepicker-toggle>
                        }
                        <mat-datepicker #expPicker></mat-datepicker>
                      </mat-form-field>
                      @if (authService.isAdmin) {
                        <mat-form-field>
                          <mat-label>Trial Expires Date</mat-label>
                          <input matInput [matDatepicker]="trialPicker" [(ngModel)]="editTrialExpiresDate"
                                 data-testid="trial-expiry-input">
                          <mat-datepicker-toggle matIconSuffix [for]="trialPicker"></mat-datepicker-toggle>
                          <mat-datepicker #trialPicker></mat-datepicker>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Tier</mat-label>
                          <mat-select [(ngModel)]="editLicenseTier" data-testid="license-tier-select">
                            <mat-option value="Free">Free</mat-option>
                            <mat-option value="Tier1">Tier 1</mat-option>
                            <mat-option value="Tier2">Tier 2</mat-option>
                          </mat-select>
                        </mat-form-field>
                        <mat-form-field>
                          <mat-label>Grace Period (days)</mat-label>
                          <input matInput type="number" [(ngModel)]="editGracePeriodDays"
                                 min="0" data-testid="grace-period-input">
                          <mat-hint>Days after expiry before features are locked (0 = immediate)</mat-hint>
                        </mat-form-field>
                        <mat-slide-toggle [(ngModel)]="editLicenseActive">Active</mat-slide-toggle>
                      }
                    </div>
                  </mat-card-content>
                  @if (authService.isAdmin) {
                    <mat-card-actions>
                      <button mat-raised-button color="primary" (click)="saveLicense()">
                        <mat-icon>save</mat-icon> Save License
                      </button>
                    </mat-card-actions>
                  }
                </mat-card>
              } @else if (authService.isAdmin) {
                <!-- Create license form (Admin only) -->
                <mat-card class="settings-card">
                  <mat-card-header><mat-card-title>Create License</mat-card-title></mat-card-header>
                  <mat-card-content>
                    <div class="form-column">
                      <mat-form-field>
                        <mat-label>App Key</mat-label>
                        <input matInput [(ngModel)]="editLicenseKey" placeholder="e.g. XXXX-XXXX-XXXX">
                      </mat-form-field>
                      <mat-form-field>
                        <mat-label>Available Date</mat-label>
                        <input matInput [matDatepicker]="createAvailPicker" [(ngModel)]="editAvailableDate">
                        <mat-datepicker-toggle matIconSuffix [for]="createAvailPicker"></mat-datepicker-toggle>
                        <mat-datepicker #createAvailPicker></mat-datepicker>
                      </mat-form-field>
                      <mat-form-field>
                        <mat-label>Expires Date</mat-label>
                        <input matInput [matDatepicker]="createExpPicker" [(ngModel)]="editExpiresDate">
                        <mat-datepicker-toggle matIconSuffix [for]="createExpPicker"></mat-datepicker-toggle>
                        <mat-datepicker #createExpPicker></mat-datepicker>
                      </mat-form-field>
                    </div>
                  </mat-card-content>
                  <mat-card-actions>
                    <button mat-raised-button color="primary" (click)="createLicense()"
                            [disabled]="!editLicenseKey.trim() || !editAvailableDate || !editExpiresDate">
                      <mat-icon>add</mat-icon> Create License
                    </button>
                  </mat-card-actions>
                </mat-card>
              } @else {
                <p class="empty-state">No license found for this store.</p>
              }
            </div>
          </mat-tab>
        }

        <!-- ── Tab 4: Data Management (Employee+) ────────────── -->
        @if (authService.isStoreEmployee) {
          <mat-tab label="Data Management">
            <div class="tab-content">
              <mat-card class="settings-card data-mgmt-card">
                <mat-card-header>
                  <mat-card-title>Data Management</mat-card-title>
                  <mat-card-subtitle>
                    @if (pendingCount > 0) {
                      {{ pendingCount }} unsync'd local change(s)
                    } @else {
                      All local changes are in sync
                    }
                  </mat-card-subtitle>
                </mat-card-header>

                <mat-card-content>
                  <!-- Sync to Server -->
                  <div class="action-row">
                    <button mat-raised-button color="primary"
                            (click)="syncToServer()"
                            [disabled]="!apiOnline || syncing || pulling || pendingCount === 0">
                      <mat-icon>sync</mat-icon>
                      Sync to Server{{ pendingCount > 0 ? ' (' + pendingCount + ')' : '' }}
                    </button>
                    <span class="action-desc">Push pending local changes to the backend.</span>
                  </div>

                  <mat-divider></mat-divider>

                  <!-- Pull from Server -->
                  <div class="action-row">
                    <button mat-stroked-button
                            (click)="pullFromServer()"
                            [disabled]="!apiOnline || syncing || pulling">
                      <mat-icon>cloud_download</mat-icon>
                      Pull from Server
                    </button>
                    <span class="action-desc">Overwrite local data with the latest from the server.</span>
                  </div>

                  <mat-divider></mat-divider>

                  <!-- Download (Export) -->
                  <div class="action-row">
                    <button mat-stroked-button (click)="downloadData()">
                      <mat-icon>save_alt</mat-icon>
                      Download (Export)
                    </button>
                    <span class="action-desc">
                      Save all local data to
                      <code>to_store_{{ storeId }}_&lt;date&gt;.json</code>.
                    </span>
                  </div>

                  <mat-divider></mat-divider>

                  <!-- Upload (Import) -->
                  <div class="action-row">
                    <button mat-stroked-button (click)="fileInput.click()">
                      <mat-icon>upload_file</mat-icon>
                      Upload (Import)
                    </button>
                    <input #fileInput type="file" accept=".json"
                           style="display:none"
                           (change)="uploadData($event)">
                    <span class="action-desc">Load data from a previously exported JSON file.</span>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>
        }

        <!-- ── Tab 5: Templates (StoreManager+) ─────────────── -->
        @if (authService.isStoreManager) {
          <mat-tab label="Templates">
            <div class="tab-content">

              <!-- New Template form -->
              @if (showNewTemplateForm) {
                <mat-card class="add-card">
                  <mat-card-header><mat-card-title>New Template</mat-card-title></mat-card-header>
                  <mat-card-content>
                    <div class="form-column">
                      <mat-form-field>
                        <mat-label>Template Name</mat-label>
                        <input matInput [(ngModel)]="newTemplateName" placeholder="Friday Night Commander">
                      </mat-form-field>
                      <mat-form-field>
                        <mat-label>Description</mat-label>
                        <input matInput [(ngModel)]="newTemplateDescription" placeholder="Optional description">
                      </mat-form-field>
                      <mat-form-field>
                        <mat-label>Format</mat-label>
                        <input matInput [(ngModel)]="newTemplateFormat" placeholder="Commander">
                      </mat-form-field>
                      <mat-form-field class="short-field">
                        <mat-label>Max Players</mat-label>
                        <input matInput type="number" [(ngModel)]="newTemplateMaxPlayers" min="2">
                      </mat-form-field>
                      <mat-form-field class="short-field">
                        <mat-label>Number of Rounds</mat-label>
                        <input matInput type="number" [(ngModel)]="newTemplateRounds" min="1">
                      </mat-form-field>
                    </div>
                  </mat-card-content>
                  <mat-card-actions>
                    <button mat-raised-button color="primary"
                            (click)="saveTemplate()"
                            [disabled]="!newTemplateName.trim()">
                      Save Template
                    </button>
                    <button mat-button (click)="cancelNewTemplate()">Cancel</button>
                  </mat-card-actions>
                </mat-card>
              } @else {
                <button mat-raised-button color="primary" (click)="startNewTemplate()">
                  <mat-icon>add</mat-icon> New Template
                </button>
              }

              <!-- Template list -->
              @if (templates.length > 0) {
                <div class="template-list">
                  @for (t of templates; track t.id) {
                    <mat-card class="template-card">
                      <mat-card-header>
                        <mat-card-title>{{ t.name }}</mat-card-title>
                        <mat-card-subtitle>{{ t.format }}</mat-card-subtitle>
                      </mat-card-header>
                      <mat-card-content>
                        <span>{{ t.maxPlayers }} players · {{ t.numberOfRounds }} rounds</span>
                        @if (t.description) {
                          <p class="template-desc">{{ t.description }}</p>
                        }
                      </mat-card-content>
                      <mat-card-actions>
                        <button mat-button color="warn" (click)="deleteTemplate(t.id)">
                          <mat-icon>delete</mat-icon> Delete
                        </button>
                      </mat-card-actions>
                    </mat-card>
                  }
                </div>
              } @else if (!showNewTemplateForm) {
                <p class="empty-state">No templates yet. Click "New Template" to create one.</p>
              }

            </div>
          </mat-tab>
        }

        <!-- ── Tab 6: Analytics (StoreManager + Tier3 or Admin) ────── -->
        @if ((authService.isStoreManager && authService.isTier3) || authService.isAdmin) {
          <mat-tab label="Analytics">
            <div class="tab-content">
              <app-store-analytics [storeId]="storeId" />
            </div>
          </mat-tab>
        } @else if (authService.isStoreManager) {
          <mat-tab label="Analytics">
            <div class="tab-content">
              <app-tier-upgrade-prompt feature="Analytics" requiredTier="Tier 3" />
            </div>
          </mat-tab>
        }

      </mat-tab-group>
    } @else {
      <p class="empty-state">Loading...</p>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .logo-section { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .store-logo { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; }
    .store-logo-placeholder { font-size: 80px; width: 80px; height: 80px; color: #999; }
    .tab-content { padding: 24px 0; }
    .settings-card { max-width: 520px; }
    .add-card { margin-bottom: 16px; }
    .table-card { margin-top: 8px; }
    .form-column { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
    .form-row { display: flex; gap: 16px; align-items: baseline; flex-wrap: wrap; }
    .name-field { min-width: 180px; }
    .email-field { min-width: 260px; }
    .empty-state { color: #666; font-style: italic; margin-top: 16px; }
    .data-mgmt-card { max-width: 600px; }
    .action-row { display: flex; align-items: center; gap: 16px; padding: 16px 0; }
    .action-desc { color: #666; font-size: 13px; flex: 1; }
    mat-divider { margin: 0; }
    .discord-connected { display: flex; align-items: center; gap: 4px; color: #1976d2; }
    .discord-connected mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .template-list { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    .template-card { max-width: 520px; }
    .template-desc { color: #666; font-size: 13px; margin: 4px 0 0; }
    .short-field { width: 160px; }
    .background-section { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .background-preview { width: 100%; max-width: 480px; height: 120px; object-fit: cover; border-radius: 8px; }
    .expiry-warning { display: flex; align-items: center; gap: 8px; color: #e65100; background: #fff3e0; border-radius: 4px; padding: 8px 12px; margin-bottom: 12px; font-size: 0.875rem; }
    .grace-warning { display: flex; align-items: center; gap: 8px; color: #842029; background: #f8d7da; border-left: 4px solid #dc3545; border-radius: 4px; padding: 8px 12px; margin-bottom: 12px; font-size: 0.875rem; }
    .trial-banner { display: flex; align-items: center; gap: 8px; padding: 12px 16px; margin-bottom: 16px; background: #e8f5e9; border-left: 4px solid #43a047; border-radius: 4px; }
    .trial-banner mat-icon { color: #2e7d32; }
    .expiry-banner { display: flex; align-items: center; gap: 8px; padding: 12px 16px; margin-bottom: 16px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; }
    .expiry-banner mat-icon { color: #856404; }
    .expiry-banner.expiry-critical { background: #f8d7da; border-left-color: #dc3545; }
    .expiry-banner.expiry-critical mat-icon { color: #842029; }
    .tier-chip-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; }
    .tier-label { font-size: 0.875rem; color: #666; }
  `]
})
export class StoreDetailComponent implements OnInit {
  store: StoreDetailDto | null = null;
  editStoreName = '';
  editDifferential = 10;
  storeId = 0;

  // Employees
  employees: AppUserDto[] = [];
  newEmployeeName = '';
  newEmployeeEmail = '';
  newEmployeeRole: 'StoreEmployee' | 'StoreManager' = 'StoreEmployee';
  readonly employeeCols = ['name', 'email', 'role', 'actions'];
  readonly EXPIRY_WARN_DAYS = 30;

  // Theme
  themes: ThemeDto[] = [];
  selectedThemeId: number | null = null;

  // Discord
  editDiscordWebhookUrl = '';
  editSellerPortalUrl = '';

  // Templates
  templates: EventTemplateDto[] = [];
  showNewTemplateForm = false;
  newTemplateName = '';
  newTemplateDescription = '';
  newTemplateFormat = 'Commander';
  newTemplateMaxPlayers = 16;
  newTemplateRounds = 4;

  // License
  license: LicenseDto | null = null;
  editLicenseKey = '';
  editAvailableDate: Date | null = null;
  editExpiresDate: Date | null = null;
  editTrialExpiresDate: Date | null = null;
  editLicenseActive = true;
  editLicenseTier: string = 'Tier2';
  editGracePeriodDays = 0;

  get daysUntilExpiry(): number | null {
    if (!this.license?.expiresDate) return null;
    const ms = new Date(this.license.expiresDate).getTime() - Date.now();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  get trialDaysRemaining(): number | null {
    if (!this.license?.trialExpiresDate) return null;
    const ms = new Date(this.license.trialExpiresDate).getTime() - Date.now();
    return Math.ceil(ms / 86400000);
  }

  get isInGracePeriod(): boolean {
    if (!this.license?.expiresDate || !this.license.gracePeriodDays) return false;
    const expired = new Date(this.license.expiresDate).getTime() < Date.now();
    if (!expired) return false;
    const graceEnd = new Date(this.license.expiresDate).getTime() + this.license.gracePeriodDays * 86400000;
    return Date.now() <= graceEnd;
  }

  get gracePeriodEndsDate(): Date | null {
    if (!this.license?.expiresDate || !this.license.gracePeriodDays) return null;
    return new Date(new Date(this.license.expiresDate).getTime() + this.license.gracePeriodDays * 86400000);
  }

  // Data Management
  private get storeSettingsPendingKey(): string {
    return `to_store_settings_pending_${this.storeId}`;
  }

  get pendingCount(): number {
    const base = this.syncService.pendingCount;
    if (!this.storeId) return base;
    const empKey = `${this.ctx.activeStorePrefix}_employees_${this.storeId}`;
    const employees: AppUserDto[] = JSON.parse(this.storage.getItem(empKey) ?? '[]');
    const deletions: number[] = JSON.parse(this.storage.getItem(`${empKey}_deletions`) ?? '[]');
    const pendingSettings = this.storage.getItem(this.storeSettingsPendingKey) ? 1 : 0;
    return base + employees.filter(e => (e.id as unknown as number) < 0).length + deletions.length + pendingSettings;
  }
  syncing = false;
  pulling = false;
  apiOnline = true;

  constructor(
    private route:        ActivatedRoute,
    private router:       Router,
    private apiService:   ApiService,
    private snackBar:     MatSnackBar,
    private cdr:          ChangeDetectorRef,
    private dialog:       MatDialog,
    private syncService:  SyncService,
    private ctx:          LocalStorageContext,
    private storage:      StorageAdapter,
    private storeContext: StoreContextService,
    private themeService: ThemeService,
    public  authService:  AuthService
  ) {}

  ngOnInit() {
    this.storeId = Number(this.route.snapshot.paramMap.get('id'));

    // Scope the local storage context to this store
    this.ctx.setActiveStore(this.storeId);

    this.apiService.getThemes().subscribe(themes => {
      this.themes = themes;
      this.cdr.detectChanges();
    });

    this.apiService.getStore(this.storeId).subscribe({
      next: store => {
        this.apiOnline = true;
        // Cache-bust the logo URL so the browser always fetches the latest image,
        // not a stale copy from a previous upload at the same path.
        this.store = store.logoUrl
          ? { ...store, logoUrl: `${store.logoUrl}?t=${Date.now()}` }
          : store;
        this.editStoreName = store.storeName;
        this.editDifferential = store.allowableTradeDifferential;
        this.selectedThemeId = store.themeId ?? null;
        this.editSellerPortalUrl = store.sellerPortalUrl ?? '';
        if (store.license) {
          this.license = store.license;
          this.editLicenseKey = store.license.appKey;
          this.editAvailableDate = new Date(store.license.availableDate);
          this.editExpiresDate = new Date(store.license.expiresDate);
          this.editTrialExpiresDate = store.license.trialExpiresDate
            ? new Date(store.license.trialExpiresDate) : null;
          this.editLicenseActive = store.license.isActive;
          this.editLicenseTier = store.license.tier ?? 'Tier2';
          this.editGracePeriodDays = store.license.gracePeriodDays ?? 0;
        }
        this.cdr.detectChanges();
        // Only load employees and templates after confirming the API is reachable.
        if (this.authService.isStoreManager) {
          this.loadEmployees();
          this.loadTemplates();
        }
      },
      error: (err) => {
        if (err?.status === 403) {
          this.snackBar.open('Access denied', 'OK', { duration: 4000 });
          this.router.navigate(['/stores']);
          return;
        }
        this.apiOnline = false;
        // Fall back to the locally-cached store so the page renders offline
        const cached = this.ctx.stores.getById(this.storeId);
        if (cached) {
          this.store = { ...cached, allowableTradeDifferential: 10, license: null };
          this.editStoreName = cached.storeName;
          this.cdr.detectChanges();
        } else {
          this.snackBar.open('Store unavailable offline', 'OK', { duration: 3000 });
        }
        if (this.authService.isStoreManager) {
          this.loadEmployeesFromCache();
        }
      }
    });
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  get publicPageUrl(): string {
    return `${window.location.origin}/stores/public/${this.store!.slug}`;
  }

  copyPublicUrl() {
    navigator.clipboard.writeText(this.publicPageUrl);
    this.snackBar.open('URL copied!', 'OK', { duration: 2000 });
  }

  previewTheme(themeId: number) {
    const t = this.themes.find(x => x.id === themeId);
    if (t) this.themeService.applyTheme(t.cssClass);
    this.cdr.detectChanges();
  }

  save() {
    if (!this.editStoreName.trim()) return;
    this.apiService.updateStore(this.storeId, {
      storeName: this.editStoreName.trim(),
      allowableTradeDifferential: this.editDifferential,
      themeId: this.selectedThemeId,
      discordWebhookUrl: this.editDiscordWebhookUrl || null,
      sellerPortalUrl: this.editSellerPortalUrl || null
    }).subscribe({
      next: updated => {
        this.store = updated.logoUrl
          ? { ...updated, logoUrl: `${updated.logoUrl}?t=${Date.now()}` }
          : updated;
        this._updateStoreName(updated.storeName);
        this.snackBar.open('Store settings saved!', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: () => {
        // Queue settings update for sync when API is unavailable
        const pending = { storeName: this.editStoreName.trim(), allowableTradeDifferential: this.editDifferential };
        this.storage.setItem(this.storeSettingsPendingKey, JSON.stringify(pending));
        this._updateStoreName(pending.storeName);
        this.snackBar.open('Settings saved locally (will sync when online)', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  private _updateStoreName(name: string): void {
    const cached = this.ctx.stores.getById(this.storeId);
    if (cached) {
      this.ctx.stores.update({ ...cached, storeName: name });
      // Mark clean immediately — store settings sync uses the raw pending key,
      // not the ctx.stores change queue. Without this, pendingCount stays at 1
      // forever after any store name save (online or offline).
      this.ctx.stores.markClean(this.storeId);
    }
    this.storeContext.storesChanged$.next();
  }

  testWebhook() {
    this.apiService.testDiscordWebhook(this.storeId).subscribe({
      next: () => this.snackBar.open('Test message sent to Discord!', 'OK', { duration: 3000 }),
      error: () => this.snackBar.open('Failed to send test message', 'OK', { duration: 3000 })
    });
  }

  // ── Employees ─────────────────────────────────────────────────────────────

  private get employeeCacheKey(): string {
    return `${this.ctx.activeStorePrefix}_employees_${this.storeId}`;
  }

  private loadEmployees() {
    this.apiService.getStoreEmployees(this.storeId).subscribe({
      next: employees => {
        // Preserve locally-added (unsynced) employees not yet pushed to the server
        const cached: AppUserDto[] = JSON.parse(this.storage.getItem(this.employeeCacheKey) ?? '[]');
        const localPending = cached.filter(e => (e.id as unknown as number) < 0);
        const merged = [...employees, ...localPending];
        this.storage.setItem(this.employeeCacheKey, JSON.stringify(merged));
        this.employees = merged;
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to load employees', 'OK', { duration: 3000 })
    });
  }

  private loadEmployeesFromCache(): void {
    const raw = this.storage.getItem(this.employeeCacheKey);
    if (raw) {
      this.employees = JSON.parse(raw) as AppUserDto[];
      this.cdr.detectChanges();
    }
  }

  addEmployee() {
    if (!this.newEmployeeEmail.trim()) return;
    this.apiService.addStoreEmployee(this.storeId, {
      name:  this.newEmployeeName.trim(),
      email: this.newEmployeeEmail.trim(),
      role:  this.newEmployeeRole
    }).subscribe({
      next: employee => {
        this.employees = [...this.employees, employee];
        this.storage.setItem(this.employeeCacheKey, JSON.stringify(this.employees));
        this.newEmployeeName = '';
        this.newEmployeeEmail = '';
        this.snackBar.open(`${employee.name} added as ${employee.role}`, 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: () => {
        // Queue locally on any failure (API offline or unreachable)
        const tempId = Math.min(0, ...this.employees.map(e => e.id)) - 1;
        const provisional: AppUserDto = {
          id:    tempId,
          name:  this.newEmployeeName.trim(),
          email: this.newEmployeeEmail.trim(),
          role:  this.newEmployeeRole,
        };
        this.employees = [...this.employees, provisional];
        this.storage.setItem(this.employeeCacheKey, JSON.stringify(this.employees));
        this.newEmployeeName = '';
        this.newEmployeeEmail = '';
        this.snackBar.open(`${provisional.name} added (will sync when online)`, 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  private get employeeDeletionsCacheKey(): string {
    return `${this.employeeCacheKey}_deletions`;
  }

  removeEmployee(userId: number) {
    this.apiService.removeStoreEmployee(this.storeId, userId).subscribe({
      next: () => {
        this.employees = this.employees.filter(e => e.id !== userId);
        this.storage.setItem(this.employeeCacheKey, JSON.stringify(this.employees));
        // Clear this userId from any pending deletions queue (in case it was queued previously)
        const pending: number[] = JSON.parse(this.storage.getItem(this.employeeDeletionsCacheKey) ?? '[]');
        const cleaned = pending.filter(id => id !== userId);
        this.storage.setItem(this.employeeDeletionsCacheKey, JSON.stringify(cleaned));
        this.snackBar.open('Employee removed', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: () => {
        // Queue the deletion for sync regardless of apiOnline flag state
        this.employees = this.employees.filter(e => e.id !== userId);
        this.storage.setItem(this.employeeCacheKey, JSON.stringify(this.employees));
        const pending: number[] = JSON.parse(this.storage.getItem(this.employeeDeletionsCacheKey) ?? '[]');
        if (!pending.includes(userId)) {
          pending.push(userId);
          this.storage.setItem(this.employeeDeletionsCacheKey, JSON.stringify(pending));
        }
        this.snackBar.open('Employee removed (will sync when online)', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  private loadTemplates(): void {
    this.apiService.getEventTemplates(this.storeId).subscribe({
      next: templates => {
        this.templates = templates;
        this.cdr.detectChanges();
      },
      error: () => { /* silently ignore — templates are non-critical */ }
    });
  }

  startNewTemplate(): void {
    this.showNewTemplateForm = true;
    this.newTemplateName = '';
    this.newTemplateDescription = '';
    this.newTemplateFormat = 'Commander';
    this.newTemplateMaxPlayers = 16;
    this.newTemplateRounds = 4;
    this.cdr.detectChanges();
  }

  cancelNewTemplate(): void {
    this.showNewTemplateForm = false;
    this.cdr.detectChanges();
  }

  saveTemplate(): void {
    if (!this.newTemplateName.trim()) return;
    const dto: CreateEventTemplateDto = {
      name:           this.newTemplateName.trim(),
      description:    this.newTemplateDescription.trim() || null,
      format:         this.newTemplateFormat.trim() || 'Commander',
      maxPlayers:     this.newTemplateMaxPlayers,
      numberOfRounds: this.newTemplateRounds,
    };
    this.apiService.createEventTemplate(this.storeId, dto).subscribe({
      next: created => {
        this.templates = [...this.templates, created];
        this.showNewTemplateForm = false;
        this.snackBar.open('Template created!', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to create template', 'OK', { duration: 3000 })
    });
  }

  deleteTemplate(id: number): void {
    this.apiService.deleteEventTemplate(this.storeId, id).subscribe({
      next: () => {
        this.templates = this.templates.filter(t => t.id !== id);
        this.cdr.detectChanges();
      },
      error: () => this.snackBar.open('Failed to delete template', 'OK', { duration: 3000 })
    });
  }

  // ── License ───────────────────────────────────────────────────────────────

  saveLicense() {
    if (!this.license || !this.editAvailableDate || !this.editExpiresDate) return;
    this.apiService.updateLicense(this.storeId, this.license.id, {
      appKey:           this.editLicenseKey.trim(),
      isActive:         this.editLicenseActive,
      availableDate:    this.editAvailableDate.toISOString(),
      expiresDate:      this.editExpiresDate.toISOString(),
      tier:             this.editLicenseTier as any,
      trialExpiresDate: this.editTrialExpiresDate?.toISOString() ?? null,
      gracePeriodDays:  this.editGracePeriodDays,
    }).subscribe({
      next: updated => {
        this.license = updated;
        this.snackBar.open('License updated!', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: (err) => this.snackBar.open(err.error?.error || 'Failed to update license', 'OK', { duration: 3000 })
    });
  }

  createLicense() {
    if (!this.editLicenseKey.trim() || !this.editAvailableDate || !this.editExpiresDate) return;
    this.apiService.createLicense(this.storeId, {
      appKey:        this.editLicenseKey.trim(),
      availableDate: this.editAvailableDate.toISOString(),
      expiresDate:   this.editExpiresDate.toISOString()
    }).subscribe({
      next: created => {
        this.license = created;
        this.editLicenseActive = created.isActive;
        this.snackBar.open('License created!', 'OK', { duration: 3000 });
        this.cdr.detectChanges();
      },
      error: (err) => this.snackBar.open(err.error?.error || 'Failed to create license', 'OK', { duration: 3000 })
    });
  }

  // ── Data Management ───────────────────────────────────────────────────────

  async syncToServer() {
    this.syncing = true;
    this.cdr.detectChanges();
    try {
      const result = await this.syncService.push();
      let msg = `Sync complete: ${result.pushed} pushed`;
      if (result.conflicts > 0) msg += `, ${result.conflicts} conflict(s) resolved`;
      if (result.errors > 0)    msg += `, ${result.errors} error(s)`;
      this.snackBar.open(msg, 'OK', { duration: 5000 });
    } finally {
      this.syncing = false;
      this.cdr.detectChanges();
    }
  }

  async pullFromServer() {
    if (this.syncService.pendingCount > 0) {
      const confirmed = await firstValueFrom(
        this.dialog.open(ConfirmDialogComponent, {
          data: {
            message:      'You have pending local changes that have not been synced. Pulling from the server will overwrite them. Continue?',
            confirmLabel: 'Pull anyway',
          }
        }).afterClosed()
      );
      if (!confirmed) return;
    }
    this.pulling = true;
    this.cdr.detectChanges();
    try {
      await this.syncService.pull();
      this.snackBar.open('Local data refreshed from server', 'OK', { duration: 3000 });
    } finally {
      this.pulling = false;
      this.cdr.detectChanges();
    }
  }

  downloadData() {
    this.syncService.exportStore(this.storeId);
  }

  // ── Logo ──────────────────────────────────────────────────────────────────

  onLogoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      if (this.store) {
        this.store = { ...this.store, logoUrl: URL.createObjectURL(file) };
        this.cdr.detectChanges();
      }
    } catch { /* preview unavailable in some environments */ }
    this.apiService.uploadStoreLogo(this.storeId, file).subscribe({
      next: dto => {
        // Append a timestamp to bust the browser cache — the server always writes to
        // the same path (/logos/{id}.ext) so the URL never changes otherwise.
        const logoUrl = dto.logoUrl ? `${dto.logoUrl}?t=${Date.now()}` : null;
        if (this.store) this.store = { ...this.store, logoUrl };
        const cached = this.ctx.stores.getById(this.storeId);
        if (cached) this.ctx.stores.update({ ...cached, logoUrl });
        this.storeContext.storesChanged$.next();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        const msg = getUploadErrorMessage(err, 'Logo upload failed');
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  // ── Background ────────────────────────────────────────────────────────────

  onBackgroundSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      if (this.store) {
        this.store = { ...this.store, backgroundImageUrl: URL.createObjectURL(file) };
        this.cdr.detectChanges();
      }
    } catch { /* preview unavailable in some environments */ }
    this.apiService.uploadStoreBackground(this.storeId, file).subscribe({
      next: dto => {
        const bgUrl = dto.backgroundImageUrl ? `${dto.backgroundImageUrl}?t=${Date.now()}` : null;
        if (this.store) this.store = { ...this.store, backgroundImageUrl: bgUrl };
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        const msg = getUploadErrorMessage(err, 'Background upload failed');
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.cdr.detectChanges();
      }
    });
  }

  async uploadData(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Reset so the same file can be re-selected if needed
    (event.target as HTMLInputElement).value = '';

    const validation = await this.syncService.validateImportFile(file, this.storeId);

    if (validation.status === 'parseError' || validation.status === 'invalidFormat') {
      this.snackBar.open(validation.error ?? 'Invalid file', 'OK', { duration: 4000 });
      return;
    }

    if (validation.status === 'storeIdMismatch') {
      const confirmed = await firstValueFrom(
        this.dialog.open(ConfirmDialogComponent, {
          data: {
            message:      `This file was exported for store #${validation.fileStoreId}, but you are viewing store #${this.storeId}. Import anyway?`,
            confirmLabel: 'Import anyway',
          }
        }).afterClosed()
      );
      if (!confirmed) return;
    }

    this.syncService.applyImport(validation.data!);
    this.snackBar.open('Data imported successfully', 'OK', { duration: 3000 });
    this.cdr.detectChanges();
  }
}
