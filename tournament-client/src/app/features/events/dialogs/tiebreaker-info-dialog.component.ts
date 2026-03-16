import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-tiebreaker-info-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>How Tiebreaker Works</h2>
    <mat-dialog-content>
      <p>When two or more players have the same number of points, the tiebreaker is used to determine their final standings order.</p>
      <p><strong>Tiebreaker = Average Opponent Conservative Score</strong></p>
      <p>For each game a player participated in, the Conservative Scores of their opponents are collected. The tiebreaker is the average of all those scores.</p>
      <p><strong>Conservative Score</strong> = Mu &minus; 3 &times; Sigma</p>
      <p>A higher tiebreaker means the player faced stronger opponents on average, and they rank higher in a tie.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `
})
export class TiebreakerInfoDialogComponent {}
