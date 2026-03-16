import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MoxfieldService {
  private cache = new Map<string, string[]>();

  constructor(private http: HttpClient) {}

  extractDeckId(url: string): string | null {
    const match = url?.match(/moxfield\.com\/decks\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  }

  getCommanders(decklistUrl: string): Observable<string[]> {
    const deckId = this.extractDeckId(decklistUrl);
    if (!deckId) return of([]);
    if (this.cache.has(deckId)) return of(this.cache.get(deckId)!);

    return this.http.get<string[]>(`/api/decklist/commanders?url=${encodeURIComponent(decklistUrl)}`).pipe(
      tap(commanders => this.cache.set(deckId, commanders)),
      catchError(() => of([]))
    );
  }
}
