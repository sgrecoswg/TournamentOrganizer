import { Component, HostListener, ChangeDetectorRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-pwa-install-prompt',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (showBanner) {
      <div class="pwa-banner">
        <mat-icon>get_app</mat-icon>
        <span>Install Tournament Organizer for offline use</span>
        <button mat-button (click)="install()">Install</button>
        <button mat-icon-button (click)="dismiss()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    }
  `,
  styles: [`
    .pwa-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: #1976d2;
      color: white;
      font-size: 14px;
    }
    .pwa-banner span { flex: 1; }
    .pwa-banner button { color: white; }
  `]
})
export class PwaInstallPromptComponent {
  showBanner = false;
  private deferredPrompt: any = null;

  constructor(private cdr: ChangeDetectorRef) {}

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: Event): void {
    event.preventDefault();
    this.deferredPrompt = event;
    this.showBanner = true;
    this.cdr.detectChanges();
  }

  install(): void {
    if (this.deferredPrompt) {
      (this.deferredPrompt as any).prompt();
    }
    this.showBanner = false;
    this.deferredPrompt = null;
    this.cdr.detectChanges();
  }

  dismiss(): void {
    this.showBanner = false;
    this.cdr.detectChanges();
  }
}
