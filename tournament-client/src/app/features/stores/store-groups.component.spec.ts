import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { StoreGroupsComponent } from './store-groups.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { StoreGroupDto } from '../../core/models/api.models';

describe('StoreGroupsComponent', () => {
  const group1: StoreGroupDto = { id: 1, name: 'Top Deck Chain', storeCount: 2 };

  const mockApi = {
    getStoreGroups:   jest.fn().mockReturnValue(of([group1])),
    createStoreGroup: jest.fn().mockReturnValue(of({ id: 2, name: 'New Group', storeCount: 0 } as StoreGroupDto)),
    deleteStoreGroup: jest.fn().mockReturnValue(of(undefined)),
    getStores:        jest.fn().mockReturnValue(of([])),
  };

  const mockAuth = { isAdmin: true };
  const mockSnackBar = { open: jest.fn() };

  function setup() {
    return TestBed.configureTestingModule({
      imports: [StoreGroupsComponent],
      providers: [
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: ApiService,  useValue: mockApi },
        { provide: AuthService, useValue: mockAuth },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockApi.getStoreGroups.mockReturnValue(of([group1]));
    mockApi.deleteStoreGroup.mockReturnValue(of(undefined));
    await setup();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('should create', () => {
    const fixture = TestBed.createComponent(StoreGroupsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('Group list rendered', () => {
    const fixture = TestBed.createComponent(StoreGroupsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Top Deck Chain');
  });

  it('Create group form appears on "New Group" button click', () => {
    const fixture = TestBed.createComponent(StoreGroupsComponent);
    const comp = fixture.componentInstance;
    comp.showCreateForm = true;
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.create-group-form')).not.toBeNull();
  });

  it('Delete calls apiService.deleteStoreGroup', () => {
    const fixture = TestBed.createComponent(StoreGroupsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.deleteGroup(1);

    expect(mockApi.deleteStoreGroup).toHaveBeenCalledWith(1);
  });
});
