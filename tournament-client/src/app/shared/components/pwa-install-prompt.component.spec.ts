import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { PwaInstallPromptComponent } from './pwa-install-prompt.component';

describe('PwaInstallPromptComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PwaInstallPromptComponent],
      providers: [provideAnimationsAsync()],
    }).compileComponents();
  });

  it('banner is hidden by default', () => {
    const fixture = TestBed.createComponent(PwaInstallPromptComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.showBanner).toBe(false);
    expect(fixture.nativeElement.querySelector('.pwa-banner')).toBeNull();
  });

  it('banner is shown after beforeinstallprompt event fires', () => {
    const fixture = TestBed.createComponent(PwaInstallPromptComponent);
    fixture.detectChanges();

    const mockEvent = { preventDefault: jest.fn() } as any;
    fixture.componentInstance.onBeforeInstallPrompt(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(fixture.componentInstance.showBanner).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pwa-banner')).not.toBeNull();
  });

  it('install() calls deferredPrompt.prompt() and hides the banner', () => {
    const fixture = TestBed.createComponent(PwaInstallPromptComponent);
    fixture.detectChanges();

    const mockPrompt = jest.fn();
    const mockEvent = { preventDefault: jest.fn(), prompt: mockPrompt } as any;
    fixture.componentInstance.onBeforeInstallPrompt(mockEvent);
    fixture.detectChanges();

    fixture.componentInstance.install();

    expect(mockPrompt).toHaveBeenCalled();
    expect(fixture.componentInstance.showBanner).toBe(false);
  });

  it('dismiss() hides the banner', () => {
    const fixture = TestBed.createComponent(PwaInstallPromptComponent);
    fixture.detectChanges();

    const mockEvent = { preventDefault: jest.fn(), prompt: jest.fn() } as any;
    fixture.componentInstance.onBeforeInstallPrompt(mockEvent);
    fixture.detectChanges();

    fixture.componentInstance.dismiss();

    expect(fixture.componentInstance.showBanner).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pwa-banner')).toBeNull();
  });
});
