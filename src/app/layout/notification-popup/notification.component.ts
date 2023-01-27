import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngxs/store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AngularFireFunctions } from '@angular/fire/functions';

import { AppEventService } from '../../services/event.service';
import { CryptoService } from '../../services/crypto.service';
import { CardsState } from '../../stateManagement/cards/cards.state';
import { FirebaseUserService } from '../../services/firebaseUser.service';
import { FirebaseProjectService } from '../../services/firebaseProject.service';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss']
})
export class NotificationComponent implements OnInit, OnDestroy {
  @Input() newNotification: number = 0;
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  currentUser: any;
  dataLoadedOnLoad = false;
  intervalRef: any;
  showLoading = true;
  taskSecretKey_httpsCallable: any;
  allNotifications = [];
  
  constructor(
    private router: Router,
    private store: Store,
    private ngFireFunctions: AngularFireFunctions,
    private appEventService: AppEventService,
    private cryptoService: CryptoService,
    private firebaseUserService: FirebaseUserService,
    private firebaseProjectService: FirebaseProjectService
  ) {
    this.taskSecretKey_httpsCallable = this.ngFireFunctions.httpsCallable('getTaskSecretKey');
    const subs = this.firebaseUserService.getCurrentUser().pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(userData => {
      //console.clear()
      //console.log(userData)
      subs.unsubscribe();
      this.currentUser = userData;
    });
   }

  ngOnInit(): void {
    const subscription = this.store
      .select((x) => x.home)
      .pipe(takeUntil(this.subscriptionDestroyed$))
      .subscribe((home) => {
        if (home.loadedInitialUserData) {
          try {
            if(subscription) {
              subscription.unsubscribe();
            }
            this.dataLoadedOnLoad = true;
          } catch (e) {
            console.log(e)
          }
          this.intervalRef = setInterval(() => {
            if(this.currentUser) {
              clearInterval(this.intervalRef);
              this.loadData();
            }
          }, 500);
        }
      });
  }

  async loadData() {
    const oldNotifications_JSON = window.localStorage.getItem(`taskkey_notification_${this.currentUser.userId}`);
    let oldNotifications = oldNotifications_JSON ? JSON.parse(oldNotifications_JSON) : [];
    
    const allNotifications = [];
    for(let notification of oldNotifications) {
      notification['isShown'] = true;
      if(notification.collection == 'chat' || notification.collection == 'comment') {
        try {
          const project = this.store.selectSnapshot(CardsState.getProjectById(notification.projectId));
          const userParticipant = project.participants.find((participant) => this.currentUser.userId == participant.id);
          const rsaDecryptKey: any = await this.getTaskSecretKey(userParticipant)

          const comment  = notification.comment.replace(/\n/g, "");
          let decryptedComment = this.cryptoService.decryptData(comment, rsaDecryptKey);
          decryptedComment = await this.mapPartiCipantIdInComments(decryptedComment);
          decryptedComment = decryptedComment.replace(/\n/g, "<br />");
          allNotifications.push({...notification, decryptedComment});
        } catch(e) {
          const decryptedComment = '$error';
          allNotifications.push({...notification, decryptedComment});
        }
      } else {
        if(notification.createdBy != this.currentUser.userId) {
          const decryptedComment = `<span class="bold">${notification.userName}</span> Invited you to join this card`;
          allNotifications.push({...notification, decryptedComment});      
        } else {
          //const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(notification.id);
          //const decryptedComment = `You invited <span>${user.name}</span> to join this card`;
          //this.allNotifications.push({...notification, decryptedComment});
        }
      }
    }
    
    this.allNotifications = allNotifications;
    window.localStorage.setItem(`taskkey_notification_${this.currentUser.userId}`, JSON.stringify(oldNotifications));
    this.showLoading = false;
  }

  async mapPartiCipantIdInComments(comment) {
    //const ids = comment.match(/(^|\s)@[A-Za-z0-9_]*($|\s)/g);
    //const ids = comment.match(/@([A-Za-z0-9])\w+/g);
    const ids = comment.match(/@[A-Za-z0-9_]*(\b)/g);
    if (ids) {
      for (let userId of ids) {
        userId = userId.trim(); // remove space
        userId = userId.substring(1) //remove '@' from userId
        if (userId) {
          const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(userId);
          const re = new RegExp("@" + userId, "g");
          comment = comment.replace(re, `<span class="bold">@${user.name ? user.name : userId}</span>`);
        }
      }
    }

    return comment;
  }

  getTaskSecretKey(userParticipant) {
    return new Promise((resolve, reject) => {
      this.taskSecretKey_httpsCallable({secret: userParticipant.secret, publicKey: this.cryptoService.rsaKeyGeneration.rsaPublicKey}).subscribe(async (response) => {
        const rsaDecryptKey =  await this.cryptoService.rsaKeyGeneration.decrypt(response);
        resolve(rsaDecryptKey)
      });
    })
  }

  closeNotificationPopup() {
    const notificationState = {
      isOpen: false,
      count: 0
    }
    this.appEventService.toggleNotificationBoxView(notificationState);
  }

  clearAllNotificatonFromLocalNRemote() {
    this.allNotifications = [];
    this.newNotification = 0;
    const logOutAndClearNotification = this.ngFireFunctions.httpsCallable('logOutAndClearNotification');
    logOutAndClearNotification({}).subscribe((response) => {
      window.localStorage.setItem(`taskkey_notification_${this.currentUser.userId}`, JSON.stringify(this.allNotifications));
      const notificationState = {
        isOpen: true,
        count: 0
      }
      this.appEventService.toggleNotificationBoxView(notificationState);
    });
  }

  showRelatedView(notification) {
    if(notification.collection == 'card') {
      this.closeNotificationPopup();
      this.triggerViewInvitationBtnClick();
    }
    if(notification.collection == 'comment') {
      this.closeNotificationPopup();
      this.router.navigateByUrl(`app/dashboard/c/${notification.projectId}/t/${notification.taskId}`);
    }
  }

  triggerViewInvitationBtnClick() {
    this.appEventService.manuallyTriggerFilterOptionBtnClickEvent.next();
  }

  ngOnDestroy() {

  }
}
