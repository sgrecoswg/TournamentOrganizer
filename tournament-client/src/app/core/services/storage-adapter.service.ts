import { Injectable } from '@angular/core';

/**
 * Thin injectable wrapper around window.localStorage.
 * Injecting this instead of using localStorage directly makes LocalTable testable.
 */
@Injectable({ providedIn: 'root' })
export class StorageAdapter {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }

  keys(): string[] {
    return Object.keys(localStorage);
  }
}
