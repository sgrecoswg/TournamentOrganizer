import { firstValueFrom } from 'rxjs';
import { StoreContextService } from './store-context.service';

describe('StoreContextService', () => {
  let service: StoreContextService;

  beforeEach(() => {
    service = new StoreContextService();
  });

  it('selectedStoreId starts as null', () => {
    expect(service.selectedStoreId).toBeNull();
  });

  it('setSelectedStoreId updates the selectedStoreId getter', () => {
    service.setSelectedStoreId(42);
    expect(service.selectedStoreId).toBe(42);
  });

  it('setSelectedStoreId(null) clears the selected store', () => {
    service.setSelectedStoreId(1);
    service.setSelectedStoreId(null);
    expect(service.selectedStoreId).toBeNull();
  });

  it('selectedStoreId$ emits new values via setSelectedStoreId', async () => {
    service.setSelectedStoreId(7);
    expect(await firstValueFrom(service.selectedStoreId$)).toBe(7);
  });

  it('storesChanged$ emits when next() is called', async () => {
    let emitted = false;
    service.storesChanged$.subscribe(() => { emitted = true; });

    service.storesChanged$.next();

    expect(emitted).toBe(true);
  });
});
