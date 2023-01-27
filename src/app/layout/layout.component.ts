import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store, Select } from '@ngxs/store';
import { CardsState } from '../stateManagement/cards/cards.state';
import { FirebaseUserService } from '../services/firebaseUser.service';


import { AppEventService } from '../services/event.service';

@Component({
  selector: 'main-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit, OnDestroy, AfterViewInit {
  public menuClosed: boolean = true;
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  public chatBoxViewer = false;
  public showNotificationBox = false;
  public currentUser: any
  public totalChatsUnreaded: Number
  public chatCountTimeOut: any;
  newNotification = 0;

  constructor(
    private appEventService: AppEventService,
    private store: Store,
    private firebaseUserService: FirebaseUserService
  ) {
    this.appEventService.toogleSideMenuEmitter.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(() => {
      this.toogleSideMenu();
    });
    this.appEventService.openChatBoxEmitter.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((data) => {
      this.chatBoxViewer = data
    });

    this.appEventService.showNotificationView.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((notificationState) => {
      this.showNotificationBox = notificationState.isOpen;
      this.newNotification = notificationState.count;
    });

    const subs = this.firebaseUserService.getCurrentUser().subscribe((userData) => {
      subs.unsubscribe();
      this.currentUser = userData;
      if(this.chatCountTimeOut) {
        clearTimeout(this.chatCountTimeOut)
      }
      const cards = this.store.selectSnapshot(
        CardsState.getCards()
      );
      if(cards) {
        this.chatCountTimeOut = setTimeout(() => {
          this.totalChatsUnreaded = 0
          if(cards.length) {
            cards.forEach(async (card) => {
              const user = card.participants.find(participant => participant.id == this.currentUser.userId);
              if(user) {
                this.totalChatsUnreaded += user.unreadChat ? user.unreadChat : 0
              }
            });
          }
        }, 0);
      }
    }, err => {
      subs.unsubscribe();
      console.log(err);
    });
  }

  ngOnInit(): void {
  }

  ngAfterViewInit() {
    const cards$ = this.store.select(
      CardsState.getCards()
    );
    cards$.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((cards) => {
      if(this.chatCountTimeOut) {
        clearTimeout(this.chatCountTimeOut)
      }
      if(cards) {
        this.chatCountTimeOut = setTimeout(() => {
          this.totalChatsUnreaded = 0
          if(cards.length && this.currentUser) {
            cards.forEach(async (card) => {
              const user = card.participants.find(participant => participant.id == this.currentUser.userId);
              if(user) {
                this.totalChatsUnreaded += user.unreadChat ? user.unreadChat : 0
              }
            });
          }
        }, 0);
      }
    });
  }

  toogleSideMenu() {
    this.menuClosed = !this.menuClosed;
    this.appEventService.toogledSideMenuEmitter.next({menuClosed: this.menuClosed})
  }

  closeNotificationPopup() {
    const notificationState = {
      isOpen: false,
      count: 0
    }
    this.appEventService.toggleNotificationBoxView(notificationState);
  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
  }

  operateChatBox () {
    if (this.chatBoxViewer) {
      this.chatBoxViewer = false
    } else if (this.chatBoxViewer === false) {
      this.chatBoxViewer = true
    }
  }

  applyStateChange (data) {
    this.chatBoxViewer = data
  }

}
