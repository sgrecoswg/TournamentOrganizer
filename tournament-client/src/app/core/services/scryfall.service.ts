import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ScryfallService {
  private readonly BASE = 'https://api.scryfall.com/cards/autocomplete';

  constructor(private http: HttpClient) {}

  getSuggestions(query: string): Observable<string[]> {
    if (!query || query.length < 2) return of([]);
    return this.http.get<{ data: string[] }>(this.BASE, { params: { q: query } }).pipe(
      map(r => r.data),
      catchError(() => of([])),
    );
  }
}
