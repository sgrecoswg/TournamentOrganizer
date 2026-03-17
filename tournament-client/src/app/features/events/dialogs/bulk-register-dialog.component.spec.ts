import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { BulkRegisterDialogComponent, BulkRegisterDialogData } from './bulk-register-dialog.component';
import { ApiService } from '../../../core/services/api.service';
import { LocalStorageContext } from '../../../core/services/local-storage-context.service';
import { BulkRegisterResultDto, PlayerDto } from '../../../core/models/api.models';

describe('BulkRegisterDialogComponent', () => {
  const alicePlayer: PlayerDto = {
    id: 10, name: 'Alice', email: 'alice@shop.com',
    mu: 25, sigma: 8.333, conservativeScore: 0,
    isRanked: false, placementGamesLeft: 5, isActive: true,
  };
  const bobPlayer: PlayerDto = {
    id: 11, name: 'Bob', email: 'bob@shop.com',
    mu: 25, sigma: 8.333, conservativeScore: 0,
    isRanked: false, placementGamesLeft: 5, isActive: true,
  };

  const dialogData: BulkRegisterDialogData = {
    eventId: 7,
    availableSlots: 4,
    registeredPlayerIds: new Set<number>(),
  };

  let mockApiService: { bulkRegisterConfirm: jest.Mock };
  let mockCtx: { players: { getAll: jest.Mock; getById: jest.Mock } };
  let mockDialogRef: { close: jest.Mock };

  function setup(data: BulkRegisterDialogData = dialogData) {
    mockApiService = { bulkRegisterConfirm: jest.fn().mockReturnValue(of({ registered: 1, created: 0, errors: [] } as BulkRegisterResultDto)) };
    mockCtx = {
      players: {
        getAll:  jest.fn().mockReturnValue([alicePlayer, bobPlayer]),
        getById: jest.fn().mockImplementation((id: number) =>
          id === alicePlayer.id ? alicePlayer : id === bobPlayer.id ? bobPlayer : null),
      },
    };
    mockDialogRef = { close: jest.fn() };

    return TestBed.configureTestingModule({
      imports: [BulkRegisterDialogComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef,    useValue: mockDialogRef },
        { provide: ApiService,      useValue: mockApiService },
        { provide: LocalStorageContext, useValue: mockCtx },
      ],
    }).compileComponents();
  }

  afterEach(() => TestBed.resetTestingModule());

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('should create', async () => {
    await setup();
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the dialog title', async () => {
    await setup();
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Bulk Register Players');
  });

  it('renders store players in the selection list', async () => {
    await setup();
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Alice');
    expect(fixture.nativeElement.textContent).toContain('Bob');
  });

  // ── Select / Deselect All ──────────────────────────────────────────────────

  it('Select All adds all pool players to selectedPlayerIds', async () => {
    await setup();
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.toggleSelectAll(true);
    expect(comp.selectedPlayerIds.size).toBe(2);
  });

  it('Deselect All clears selectedPlayerIds', async () => {
    await setup();
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.toggleSelectAll(true);
    comp.toggleSelectAll(false);
    expect(comp.selectedPlayerIds.size).toBe(0);
  });

  // ── Register Selected → preview ────────────────────────────────────────────

  it('onRegisterSelected builds previewData and shows preview panel', async () => {
    await setup();
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.selectedPlayerIds.add(alicePlayer.id);
    comp.onRegisterSelected();
    expect(comp.showPreview).toBe(true);
    expect(comp.previewData?.found.length).toBe(1);
    expect(comp.previewData?.found[0].email).toBe(alicePlayer.email);
  });

  it('already-registered players go into previewData.alreadyRegistered', async () => {
    const dataWithAliceRegistered: BulkRegisterDialogData = {
      ...dialogData,
      registeredPlayerIds: new Set([alicePlayer.id]),
    };
    await setup(dataWithAliceRegistered);
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.selectedPlayerIds.add(alicePlayer.id);
    comp.onRegisterSelected();
    expect(comp.previewData?.alreadyRegistered.length).toBe(1);
    expect(comp.previewData?.found.length).toBe(0);
  });

  // ── Capacity guard ─────────────────────────────────────────────────────────

  it('previewOverCapacity is true when selection exceeds availableSlots', async () => {
    const tightData: BulkRegisterDialogData = { ...dialogData, availableSlots: 1 };
    await setup(tightData);
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.selectedPlayerIds.add(alicePlayer.id);
    comp.selectedPlayerIds.add(bobPlayer.id);
    comp.onRegisterSelected();
    expect(comp.previewOverCapacity).toBe(true);
  });

  it('confirmBulkRegistration is blocked when previewOverCapacity', async () => {
    const tightData: BulkRegisterDialogData = { ...dialogData, availableSlots: 1 };
    await setup(tightData);
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.selectedPlayerIds.add(alicePlayer.id);
    comp.selectedPlayerIds.add(bobPlayer.id);
    comp.onRegisterSelected();
    comp.confirm();
    expect(mockApiService.bulkRegisterConfirm).not.toHaveBeenCalled();
  });

  // ── Confirm ────────────────────────────────────────────────────────────────

  it('confirm calls bulkRegisterConfirm and closes the dialog with the result', async () => {
    await setup();
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.selectedPlayerIds.add(alicePlayer.id);
    comp.onRegisterSelected();
    comp.confirm();
    expect(mockApiService.bulkRegisterConfirm).toHaveBeenCalledWith(
      dialogData.eventId,
      expect.objectContaining({
        registrations: expect.arrayContaining([
          expect.objectContaining({ playerId: alicePlayer.id }),
        ]),
      }),
    );
    expect(mockDialogRef.close).toHaveBeenCalledWith(
      expect.objectContaining({ registered: 1 }),
    );
  });

  // ── Cancel ─────────────────────────────────────────────────────────────────

  it('cancel closes the dialog without a result', async () => {
    await setup();
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    fixture.componentInstance.cancel();
    expect(mockDialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it('cancelPreview hides the preview panel', async () => {
    await setup();
    const fixture = TestBed.createComponent(BulkRegisterDialogComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.selectedPlayerIds.add(alicePlayer.id);
    comp.onRegisterSelected();
    expect(comp.showPreview).toBe(true);
    comp.cancelPreview();
    expect(comp.showPreview).toBe(false);
  });
});
