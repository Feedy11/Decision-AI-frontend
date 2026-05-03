import { TestBed } from '@angular/core/testing';

import { IaServicesService } from './ia-services.service';

describe('IaServicesService', () => {
  let service: IaServicesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IaServicesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
