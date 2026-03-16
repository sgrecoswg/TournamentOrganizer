import { TestBed } from '@angular/core/testing';
import { StorageAdapter } from './storage-adapter.service';

describe('StorageAdapter', () => {
  let service: StorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageAdapter);
  });

  afterEach(() => localStorage.clear());

  // ─── getItem ──────────────────────────────────────────────────────────────

  describe('getItem()', () => {
    it('returns null for a key that does not exist', () => {
      expect(service.getItem('missing')).toBeNull();
    });

    it('returns the stored value for an existing key', () => {
      localStorage.setItem('foo', 'bar');
      expect(service.getItem('foo')).toBe('bar');
    });

    it('returns null after the key has been removed', () => {
      localStorage.setItem('foo', 'bar');
      localStorage.removeItem('foo');
      expect(service.getItem('foo')).toBeNull();
    });
  });

  // ─── setItem ──────────────────────────────────────────────────────────────

  describe('setItem()', () => {
    it('writes a value that is then readable via localStorage', () => {
      service.setItem('key1', 'value1');
      expect(localStorage.getItem('key1')).toBe('value1');
    });

    it('overwrites an existing value', () => {
      localStorage.setItem('key1', 'old');
      service.setItem('key1', 'new');
      expect(localStorage.getItem('key1')).toBe('new');
    });

    it('stores serialised JSON strings correctly', () => {
      const obj = { a: 1, b: [2, 3] };
      service.setItem('obj', JSON.stringify(obj));
      expect(JSON.parse(localStorage.getItem('obj')!)).toEqual(obj);
    });
  });

  // ─── removeItem ───────────────────────────────────────────────────────────

  describe('removeItem()', () => {
    it('deletes an existing key', () => {
      localStorage.setItem('k', 'v');
      service.removeItem('k');
      expect(localStorage.getItem('k')).toBeNull();
    });

    it('does not throw when the key does not exist', () => {
      expect(() => service.removeItem('nonexistent')).not.toThrow();
    });

    it('only removes the targeted key, leaving others intact', () => {
      localStorage.setItem('a', '1');
      localStorage.setItem('b', '2');
      service.removeItem('a');
      expect(localStorage.getItem('a')).toBeNull();
      expect(localStorage.getItem('b')).toBe('2');
    });
  });

  // ─── keys ─────────────────────────────────────────────────────────────────

  describe('keys()', () => {
    it('returns an empty array when localStorage is empty', () => {
      expect(service.keys()).toEqual([]);
    });

    it('returns all stored keys', () => {
      localStorage.setItem('x', '1');
      localStorage.setItem('y', '2');
      expect(service.keys().sort()).toEqual(['x', 'y']);
    });

    it('reflects keys added via setItem()', () => {
      service.setItem('z', '3');
      expect(service.keys()).toContain('z');
    });

    it('does not include a key after removeItem()', () => {
      localStorage.setItem('gone', 'soon');
      service.removeItem('gone');
      expect(service.keys()).not.toContain('gone');
    });
  });

  // ─── round-trip ───────────────────────────────────────────────────────────

  describe('round-trip (setItem → getItem)', () => {
    it('returns the exact value that was stored', () => {
      service.setItem('rt', 'hello world');
      expect(service.getItem('rt')).toBe('hello world');
    });

    it('getItem reflects a value written by setItem immediately', () => {
      service.setItem('immediate', 'yes');
      expect(service.getItem('immediate')).toBe('yes');
    });
  });
});
