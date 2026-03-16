import { TestBed } from '@angular/core/testing';
import { PlacementBadgeComponent } from './placement-badge.component';

describe('PlacementBadgeComponent', () => {
  function create(isRanked: boolean, gamesLeft: number) {
    TestBed.configureTestingModule({ imports: [PlacementBadgeComponent] });
    const fixture = TestBed.createComponent(PlacementBadgeComponent);
    fixture.componentInstance.isRanked = isRanked;
    fixture.componentInstance.gamesLeft = gamesLeft;
    fixture.detectChanges();
    return fixture;
  }

  it('should create the component', () => {
    const fixture = create(false, 5);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows "Ranked" chip when isRanked is true', () => {
    const fixture = create(true, 0);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Ranked');
    expect(el.textContent).not.toContain('Unranked');
  });

  it('shows "Unranked" chip with games-left count when isRanked is false', () => {
    const fixture = create(false, 3);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Unranked');
    expect(el.textContent).toContain('3');
  });

  it('defaults: isRanked=false, gamesLeft=0', () => {
    TestBed.configureTestingModule({ imports: [PlacementBadgeComponent] });
    const fixture = TestBed.createComponent(PlacementBadgeComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.isRanked).toBe(false);
    expect(fixture.componentInstance.gamesLeft).toBe(0);
  });
});
