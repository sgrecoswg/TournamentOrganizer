import { Component, Input, Output, EventEmitter, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-pod-timer',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule],
  template: `
    <div class="pod-timer">
      @if (state === 'idle') {
        <div class="timer-idle">
          <button mat-raised-button color="primary" (click)="start()">
            <mat-icon>play_arrow</mat-icon> Start Timer ({{ defaultMinutes }}m)
          </button>
        </div>
      } @else if (state === 'extraTurns') {
        <div class="extra-turns">
          <span class="extra-turns-label">EXTRA TURNS</span>
          <span class="turn-counter">Turn {{ extraTurnCount }} / 5</span>
          <div class="extra-turns-controls">
            @if (extraTurnCount < 5) {
              <button mat-raised-button color="accent" (click)="nextTurn()">
                <mat-icon>skip_next</mat-icon> Next Turn
              </button>
            }
            <button mat-button (click)="reset()">
              <mat-icon>stop</mat-icon> Reset
            </button>
          </div>
        </div>
      } @else {
        <div class="timer-running">
          <span class="timer-display"
                [class.warning]="remainingSeconds < 300 && remainingSeconds > 0"
                [class.expired]="remainingSeconds <= 0">
            {{ displayTime }}
          </span>
          <div class="timer-controls">
            <button mat-mini-fab color="primary" (click)="addTime(-60)" [disabled]="remainingSeconds <= 60">
              <mat-icon>remove</mat-icon>
            </button>
            <button mat-mini-fab color="primary" (click)="addTime(60)">
              <mat-icon>add</mat-icon>
            </button>
            @if (state === 'paused') {
              <button mat-raised-button color="primary" (click)="resume()">
                <mat-icon>play_arrow</mat-icon>
              </button>
            } @else {
              <button mat-raised-button color="warn" (click)="pause()">
                <mat-icon>pause</mat-icon>
              </button>
            }
            <button mat-button (click)="reset()">
              <mat-icon>stop</mat-icon>
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .pod-timer { padding: 8px 0; }
    .timer-idle { display: flex; align-items: center; }
    .timer-running { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .timer-display { font-size: 1.5rem; font-weight: bold; font-family: monospace; min-width: 80px; }
    .timer-controls { display: flex; gap: 6px; align-items: center; }
    .warning { color: #ff9800; }
    .expired { color: #f44336; }
    .extra-turns { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .extra-turns-label { font-weight: bold; color: #f44336; font-size: 1.1rem; }
    .turn-counter { font-size: 1.2rem; font-weight: bold; font-family: monospace; }
    .extra-turns-controls { display: flex; gap: 8px; align-items: center; }
  `]
})
export class PodTimerComponent implements OnDestroy {
  @Input() podId = 0;
  @Input() defaultMinutes = 55;
  @Output() drawDeclared = new EventEmitter<void>();

  constructor(private cdr: ChangeDetectorRef) {}

  state: 'idle' | 'running' | 'paused' | 'extraTurns' = 'idle';
  remainingSeconds = 0;
  extraTurnCount = 0;
  private intervalId: any = null;

  get displayTime(): string {
    const abs = Math.abs(this.remainingSeconds);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    const sign = this.remainingSeconds < 0 ? '-' : '';
    return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  start() {
    this.remainingSeconds = this.defaultMinutes * 60;
    this.state = 'running';
    this.tick();
  }

  pause() {
    this.state = 'paused';
    this.clearInterval();
  }

  resume() {
    this.state = 'running';
    this.tick();
  }

  addTime(seconds: number) {
    this.remainingSeconds += seconds;
  }

  reset() {
    this.clearInterval();
    this.state = 'idle';
    this.remainingSeconds = 0;
    this.extraTurnCount = 0;
  }

  enterExtraTurns() {
    this.clearInterval();
    this.state = 'extraTurns';
    this.extraTurnCount = 1;
  }

  nextTurn() {
    if (this.extraTurnCount < 5) {
      this.extraTurnCount++;
    }
  }

  declareDraw() {
    this.drawDeclared.emit();
  }

  private tick() {
    this.clearInterval();
    this.intervalId = setInterval(() => {
      this.remainingSeconds--;
      if (this.remainingSeconds <= 0 && this.state === 'running') {
        this.enterExtraTurns();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  private clearInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  ngOnDestroy() {
    this.clearInterval();
  }
}
