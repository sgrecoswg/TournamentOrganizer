import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ScryfallService } from './scryfall.service';

describe('ScryfallService', () => {
  let service: ScryfallService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ScryfallService],
    });
    service = TestBed.inject(ScryfallService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getSuggestions("") returns [] without making an HTTP request', done => {
    service.getSuggestions('').subscribe(result => {
      expect(result).toEqual([]);
      httpMock.expectNone('https://api.scryfall.com/cards/autocomplete');
      done();
    });
  });

  it('getSuggestions("l") — single char — returns [] without HTTP request', done => {
    service.getSuggestions('l').subscribe(result => {
      expect(result).toEqual([]);
      httpMock.expectNone('https://api.scryfall.com/cards/autocomplete');
      done();
    });
  });

  it('getSuggestions("li") calls GET /cards/autocomplete?q=li and maps .data', done => {
    service.getSuggestions('li').subscribe(result => {
      expect(result).toEqual(['Lightning Bolt', 'Lightning Helix']);
      done();
    });

    const req = httpMock.expectOne(r =>
      r.url === 'https://api.scryfall.com/cards/autocomplete' && r.params.get('q') === 'li',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ object: 'catalog', data: ['Lightning Bolt', 'Lightning Helix'] });
  });

  it('getSuggestions maps full card name list from .data array', done => {
    service.getSuggestions('sol').subscribe(result => {
      expect(result).toEqual(['Sol Ring', 'Sol Talisman']);
      done();
    });

    const req = httpMock.expectOne(r => r.params.get('q') === 'sol');
    req.flush({ object: 'catalog', data: ['Sol Ring', 'Sol Talisman'] });
  });

  it('HTTP error returns [] without throwing', done => {
    service.getSuggestions('crash').subscribe(result => {
      expect(result).toEqual([]);
      done();
    });

    const req = httpMock.expectOne(r => r.params.get('q') === 'crash');
    req.error(new ProgressEvent('error'));
  });
});
