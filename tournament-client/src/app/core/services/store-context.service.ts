import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StoreContextService {
  private selectedStoreIdSubject = new BehaviorSubject<number | null>(null);
  selectedStoreId$ = this.selectedStoreIdSubject.asObservable();

  /** Emits whenever a store's name/details change locally so consumers can refresh their store lists. */
  storesChanged$ = new Subject<void>();

  get selectedStoreId(): number | null {
    return this.selectedStoreIdSubject.value;
  }

  setSelectedStoreId(id: number | null) {
    this.selectedStoreIdSubject.next(id);
  }
}
