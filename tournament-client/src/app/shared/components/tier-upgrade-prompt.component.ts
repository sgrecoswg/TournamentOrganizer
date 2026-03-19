import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-tier-upgrade-prompt',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="tier-locked">
      <mat-icon>lock</mat-icon>
      <span>{{ feature }} requires {{ requiredTier }}. Contact your administrator to upgrade.</span>
    </div>
  `,
  styles: [`
    .tier-locked {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
      font-size: 0.875rem;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 4px;
    }
  `]
})
export class TierUpgradePromptComponent {
  @Input() requiredTier!: string;
  @Input() feature!: string;
}
