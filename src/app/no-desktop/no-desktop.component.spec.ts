import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NoDesktopComponent } from './no-desktop.component';

describe('NoDesktopComponent', () => {
  let component: NoDesktopComponent;
  let fixture: ComponentFixture<NoDesktopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NoDesktopComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NoDesktopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
