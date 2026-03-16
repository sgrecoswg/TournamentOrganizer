import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TiebreakerInfoDialogComponent } from './tiebreaker-info-dialog.component';

describe('TiebreakerInfoDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TiebreakerInfoDialogComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MatDialogRef, useValue: { close: jest.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: {} },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(TiebreakerInfoDialogComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the dialog title "How Tiebreaker Works"', () => {
    const fixture = TestBed.createComponent(TiebreakerInfoDialogComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('How Tiebreaker Works');
  });

  it('explains that tiebreaker = average opponent conservative score', () => {
    const fixture = TestBed.createComponent(TiebreakerInfoDialogComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Average Opponent Conservative Score');
  });

  it('shows the conservative score formula', () => {
    const fixture = TestBed.createComponent(TiebreakerInfoDialogComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    // Formula: Conservative Score = Mu − 3 × Sigma
    expect(el.textContent).toContain('Conservative Score');
    expect(el.textContent).toContain('Sigma');
  });

  it('renders a Close button', () => {
    const fixture = TestBed.createComponent(TiebreakerInfoDialogComponent);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const closeBtn = Array.from(buttons).find(
      (b: any) => b.textContent?.trim() === 'Close'
    );
    expect(closeBtn).toBeTruthy();
  });

  it('Close button carries the mat-dialog-close directive', () => {
    const fixture = TestBed.createComponent(TiebreakerInfoDialogComponent);
    fixture.detectChanges();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const closeBtn = Array.from(buttons).find(b => b.textContent?.trim() === 'Close');
    // mat-dialog-close adds a [mat-dialog-close] attribute
    expect(closeBtn?.hasAttribute('mat-dialog-close')).toBe(true);
  });
});
