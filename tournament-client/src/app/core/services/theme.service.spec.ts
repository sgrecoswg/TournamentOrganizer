import { TestBed } from '@angular/core/testing';
import { RendererFactory2 } from '@angular/core';
import { ThemeService } from './theme.service';
import { StoreDetailDto } from '../models/api.models';

describe('ThemeService', () => {
  let service: ThemeService;
  let addClassSpy: jest.Mock;
  let removeClassSpy: jest.Mock;

  beforeEach(() => {
    addClassSpy    = jest.fn();
    removeClassSpy = jest.fn();

    const mockRendererFactory: Partial<RendererFactory2> = {
      createRenderer: jest.fn().mockReturnValue({
        addClass:    addClassSpy,
        removeClass: removeClassSpy,
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: RendererFactory2, useValue: mockRendererFactory },
      ],
    });

    service = TestBed.inject(ThemeService);
    localStorage.clear();
  });

  // ── applyTheme ────────────────────────────────────────────────────────

  it('applyTheme adds the given class to document.body', () => {
    service.applyTheme('theme-dark');
    expect(addClassSpy).toHaveBeenCalledWith(document.body, 'theme-dark');
  });

  it('applyTheme removes all other theme classes before adding the new one', () => {
    service.applyTheme('theme-dark');
    expect(removeClassSpy).toHaveBeenCalledWith(document.body, 'theme-default');
    expect(removeClassSpy).toHaveBeenCalledWith(document.body, 'theme-forest');
    expect(removeClassSpy).toHaveBeenCalledWith(document.body, 'theme-ocean');
  });

  it('applyTheme saves the class to localStorage', () => {
    service.applyTheme('theme-forest');
    expect(localStorage.getItem('app_theme')).toBe('theme-forest');
  });

  it('applyTheme falls back to theme-default when called with empty string', () => {
    service.applyTheme('');
    expect(addClassSpy).toHaveBeenCalledWith(document.body, 'theme-default');
  });

  // ── getSavedTheme ─────────────────────────────────────────────────────

  it('getSavedTheme returns null when nothing is stored', () => {
    expect(service.getSavedTheme()).toBeNull();
  });

  it('getSavedTheme returns the previously saved theme', () => {
    localStorage.setItem('app_theme', 'theme-ocean');
    expect(service.getSavedTheme()).toBe('theme-ocean');
  });

  // ── resolveAndApply ───────────────────────────────────────────────────

  it('resolveAndApply uses localStorage theme when available, ignoring store theme', () => {
    localStorage.setItem('app_theme', 'theme-dark');
    const store = { themeCssClass: 'theme-forest' } as Partial<StoreDetailDto> as StoreDetailDto;
    service.resolveAndApply(store);
    expect(addClassSpy).toHaveBeenCalledWith(document.body, 'theme-dark');
  });

  it('resolveAndApply uses store theme when localStorage is empty', () => {
    const store = { themeCssClass: 'theme-ocean' } as Partial<StoreDetailDto> as StoreDetailDto;
    service.resolveAndApply(store);
    expect(addClassSpy).toHaveBeenCalledWith(document.body, 'theme-ocean');
  });

  it('resolveAndApply falls back to theme-default when both are null', () => {
    service.resolveAndApply(null);
    expect(addClassSpy).toHaveBeenCalledWith(document.body, 'theme-default');
  });
});
