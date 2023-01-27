import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppEventService } from '../../services/event.service';
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  cardFilterType = '';
  isEmpty = false;
  isNightTime = false;
  checkTimeInterval: any;

  constructor(
    private appEventService: AppEventService
  ) {
    this.checkIsNight();
    clearInterval(this.checkTimeInterval);
    this.checkTimeInterval = setInterval(() => {
      this.checkIsNight();
    }, 10000);


    this.appEventService.toogleNoNewCardViewEmitter.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((data) => {
      this.cardFilterType = data.filterType;
      this.isEmpty = data.show;
    });
  }

  ngOnInit(): void {
  }

  checkIsNight() {
    const currentTime = new Date();
    if(currentTime.getHours() > 17 || currentTime.getHours() < 8) {
      this.isNightTime = true;
    } else {
      this.isNightTime = false;
    }
  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
    clearInterval(this.checkTimeInterval);
  }
}
