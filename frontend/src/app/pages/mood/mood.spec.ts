import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Mood } from './mood';

describe('Mood', () => {
  let component: Mood;
  let fixture: ComponentFixture<Mood>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Mood]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Mood);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
