import { Injectable, RendererFactory2, Renderer2 } from '@angular/core';
import { StoreDetailDto } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private renderer: Renderer2;
  private readonly STORAGE_KEY = 'app_theme';
  private readonly DEFAULT_CLASS = 'theme-default';
  private readonly ALL_CLASSES = ['theme-default', 'theme-dark', 'theme-forest', 'theme-ocean'];

  constructor(factory: RendererFactory2) {
    this.renderer = factory.createRenderer(null, null);
  }

  applyTheme(cssClass: string) {
    const body = document.body;
    const target = cssClass || this.DEFAULT_CLASS;
    this.ALL_CLASSES.forEach(c => this.renderer.removeClass(body, c));
    this.renderer.addClass(body, target);
    localStorage.setItem(this.STORAGE_KEY, target);
  }

  getSavedTheme(): string | null {
    return localStorage.getItem(this.STORAGE_KEY);
  }

  resolveAndApply(store: StoreDetailDto | null) {
    const cssClass = this.getSavedTheme() ?? store?.themeCssClass ?? this.DEFAULT_CLASS;
    this.applyTheme(cssClass ?? this.DEFAULT_CLASS);
  }
}
