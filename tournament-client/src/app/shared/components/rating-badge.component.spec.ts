import { TestBed } from '@angular/core/testing';
import { RatingBadgeComponent } from './rating-badge.component';

describe('RatingBadgeComponent', () => {
  describe('getColor()', () => {
    let component: RatingBadgeComponent;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [RatingBadgeComponent] });
      const fixture = TestBed.createComponent(RatingBadgeComponent);
      component = fixture.componentInstance;
    });

    it('returns green (#4caf50) for score >= 30', () => {
      component.score = 30;
      expect(component.getColor()).toBe('#4caf50');

      component.score = 35;
      expect(component.getColor()).toBe('#4caf50');
    });

    it('returns light green (#8bc34a) for score >= 20 and < 30', () => {
      component.score = 20;
      expect(component.getColor()).toBe('#8bc34a');

      component.score = 29;
      expect(component.getColor()).toBe('#8bc34a');
    });

    it('returns yellow (#ffc107) for score >= 10 and < 20', () => {
      component.score = 10;
      expect(component.getColor()).toBe('#ffc107');

      component.score = 19;
      expect(component.getColor()).toBe('#ffc107');
    });

    it('returns orange (#ff9800) for score >= 0 and < 10', () => {
      component.score = 0;
      expect(component.getColor()).toBe('#ff9800');

      component.score = 9;
      expect(component.getColor()).toBe('#ff9800');
    });

    it('returns red (#f44336) for negative scores', () => {
      component.score = -1;
      expect(component.getColor()).toBe('#f44336');

      component.score = -25;
      expect(component.getColor()).toBe('#f44336');
    });
  });
});
