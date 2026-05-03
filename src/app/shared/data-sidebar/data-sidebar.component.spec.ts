import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DataSidebarComponent } from './data-sidebar.component';

describe('DataSidebarComponent', () => {
  let component: DataSidebarComponent;
  let fixture: ComponentFixture<DataSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataSidebarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DataSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
