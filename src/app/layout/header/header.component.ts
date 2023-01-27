import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd, RouterEvent } from '@angular/router';
import { AngularFirestore } from '@angular/fire/firestore';
//import { BsDropdownConfig } from 'ngx-bootstrap/dropdown';
import { Store } from '@ngxs/store';
import { Subject, Subscription } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import * as moment from 'moment';
import { AngularFireFunctions } from '@angular/fire/functions';

import { CreateCardComponent } from './../../dashboard/create-card/create-card.component';
import { CardsState } from '../../stateManagement/cards/cards.state';
import { AuthService } from '../../services/auth.service';
import { AppEventService } from '../../services/event.service';
import { FirebaseUserService } from '../../services/firebaseUser.service';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { SettingsComponent } from '../../settings/settings.component'
import { FirebaseProjectService } from 'src/app/services/firebaseProject.service';
import { FirebaseTaskService } from 'src/app/services/firebaseTask.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  //providers: [{ provide: BsDropdownConfig, useValue: { isAnimated: true, autoClose: true } }],
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit,OnDestroy {
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  public modalRef: BsModalRef;
  public acronyName: string = '';
  public imguser: any
  public subscription: any;
  public isPlannerView = false;
  public filterOption = 'active';
  public isDashboardView = false;
  public isArchiveViewActive = false;
  public chatBoxViewer = false;
  public totalChatsUnreaded: number;
  public chatCountTimeOut: any;
  public chatBoxOpened = false;
  currentUser: any;
  isOnline = false;
  newCardCount = 0;
  allNotification = [];
  newNotification = 0;
  totalNotification = 0;
  showNotificationBox = false;
  isTabVisible: any;
  tabVisibilityChangeHandler: any;
  notificationState = {
    chatUnread: 0,
    oldNotificationCount: 0
  };
  getNotificationSubs: Subscription;
  eventKey = '';

  constructor(
    private router: Router,
    private store: Store,
    private ngFirestore: AngularFirestore,
    private ngFireFunctions: AngularFireFunctions,
    private firebaseUserService: FirebaseUserService,
    private authService: AuthService,
    private appEventService: AppEventService,
    private modalService: BsModalService,
    private firebaseProjectService: FirebaseProjectService,
    private firebaseTaskService: FirebaseTaskService
  ) {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntil(this.subscriptionDestroyed$)).subscribe((endUrl: NavigationEnd) => {
      const currentUrl = endUrl.urlAfterRedirects;
      if (currentUrl.indexOf('app/planner') != -1) {
        this.isPlannerView = true;
      } else {
        this.isPlannerView = false;
      }
      if (currentUrl.indexOf('app/dashboard') != -1) {
        this.isDashboardView = true;
      } else {
        this.isDashboardView = false;
      }
      if (currentUrl.indexOf('app/archive') != -1) {
        this.isArchiveViewActive = true;
      } else {
        this.isArchiveViewActive = false;
      }
    });
    this.appEventService.openChatBoxEmitter.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((data) => {
      this.chatBoxOpened = data
    });

    this.appEventService.showNotificationView.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((notificationState) => {
      this.showNotificationBox = notificationState.isOpen;
      this.newNotification = notificationState.count;
    });

    this.appEventService.manuallyTriggerFilterOptionBtnClickEvent.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((notificationState) => {
      this.filterOption = 'new';
      this.appEventService.onClickCardFilter.next({value: this.filterOption});
    });
    
    const subs = this.firebaseUserService.getCurrentUser().pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(userData => {
      subs.unsubscribe();
      const user = userData;
      if(user) {
        this.currentUser = user;
        this.isOnline = this.currentUser.isOnline ? true : false;
        this.getCards();
        this.getNSetNotificationData();
        this.subscription = this.firebaseUserService.getUserByIdForGuard(user.userId).subscribe((userData) => {
          this.imguser = userData.profileImage ? userData.profileImage : 'N/A'
          if(userData && userData.name) {
            this.acronyName = this.acronym(user.name);
          } else {
            this.acronyName = 'N/A';
          }
        });
      }
    });

    this.isTabVisible = (() => {
      let stateKey;
      const keys = {
          hidden: "visibilitychange",
          webkitHidden: "webkitvisibilitychange",
          mozHidden: "mozvisibilitychange",
          msHidden: "msvisibilitychange"
      };
      for (stateKey in keys) {
          if (stateKey in document) {
              this.eventKey = keys[stateKey];
              break;
          }
      }
      return (c) => {
          if (c) document.addEventListener(this.eventKey, c);
          return !document[stateKey];
      }
    })();

    this.tabVisibilityChangeHandler = () => {
      if(!this.isTabVisible()) {
        this.notificationState = {
          chatUnread: this.totalChatsUnreaded,
          oldNotificationCount: this.totalNotification
        }
      } else {
        document.title = 'Taskkey';
      }
    }
    
    this.isTabVisible(this.tabVisibilityChangeHandler)
  }



  ngOnInit(): void {
    
  }

  getCards() {
    this.store.select(
      CardsState.getCards()
    ).pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(cards => {
      
      if(this.chatCountTimeOut) {
        clearTimeout(this.chatCountTimeOut)
      }
      if(cards) {
        this.chatCountTimeOut = setTimeout(() => {
          const newCards = [];
          this.totalChatsUnreaded = 0
          if(cards.length && this.currentUser) {
            cards.forEach(async (card) => {
              const user = card.participants.find(participant => participant.id == this.currentUser.userId);
              if(user) {
                if(!(user.status != 1)) {            
                  newCards.push(card)
                }
                this.totalChatsUnreaded += user.unreadChat ? user.unreadChat : 0
              }
            });
            this.newCardCount = newCards.length;
            //console.log(this.newCardCount);
            if(!this.isTabVisible()) {
              if(this.notificationState.chatUnread < this.totalChatsUnreaded && this.notificationState.oldNotificationCount < this.totalNotification) {
                document.title = 'Taskkey - New chat message + notification';
              } else if(this.notificationState.chatUnread < this.totalChatsUnreaded) {
                document.title = 'Taskkey - New chat message';
              }
            }
          }
        }, 0);
      }
      
    })
  }

  getNSetNotificationData() {
    if(this.getNotificationSubs) {
      this.getNotificationSubs.unsubscribe();
    }
    this.getNotificationSubs = this.ngFirestore.collection('notification').doc(this.currentUser.userId).snapshotChanges().subscribe(async (response) => {
      const allNotificationObj: any = response.payload.exists ? response.payload.data(): {};
      const allNotificationArr = [];
      this.newNotification = 0;
      let totalNotification = 0;

      const oldNotifications_JSON = window.localStorage.getItem(`taskkey_notification_${this.currentUser.userId}`);
      let oldNotifications = oldNotifications_JSON ? JSON.parse(oldNotifications_JSON) : [];

      if(allNotificationObj.card) {
        for(let notification of Object.keys(allNotificationObj.card)) {
          if(allNotificationObj.card[notification].createdBy != this.currentUser.userId) {
            totalNotification = totalNotification + 1;
            const searchedNotification = oldNotifications.find(n => n.recordId == notification);
            if(!searchedNotification) {
              allNotificationArr.push({...allNotificationObj.card[notification], collection: 'card', recordId: notification, totalCount: 1});
              this.newNotification = this.newNotification + 1;
            } else if(searchedNotification) {
              allNotificationArr.push({...searchedNotification});
              if(!searchedNotification.isShown) {
                this.newNotification = this.newNotification + 1;
              }
            }
          }
        }
      }

      if(allNotificationObj.chat) {
        const tempChatNotifications = [];
        for(let notification of Object.keys(allNotificationObj.chat)) {
          let miliseconds = 0;
          const notificationObj: any = allNotificationObj.chat[notification];
          if (notificationObj.timestamp) {
            miliseconds = parseInt((notificationObj.timestamp.seconds * 1000).toString()) + parseInt((notificationObj.timestamp.nanoseconds / 1000000).toString());
          }

          tempChatNotifications.push({...notificationObj, collection: 'chat', recordId: notification, miliseconds});
        }
        const chatNotifications = tempChatNotifications.sort((a, b) => (a.miliseconds > b.miliseconds) ? -1 : 1).slice(0, 20);
        //console.log('chatNotifications', chatNotifications)
        const counts = chatNotifications.reduce((p, c) => {
          const projectId = c.projectId;
          if (!p.hasOwnProperty(projectId)) {
            p[projectId] = 0;
          }
          p[projectId]++;
          return p;
        }, {});

        //console.log('counts', counts)
        
        for(let projectId of Object.keys(counts)) {
          const project_l = this.store.selectSnapshot(CardsState.getProjectById(projectId));

          let project_r = null;
          if (!project_l) {
            let response: any = await this.firebaseProjectService.getProjectById(projectId, this.currentUser.userId);
            const docs = response.docs.map(doc => doc.data())
            if(docs.length > 0) {
              project_r = docs[0];
            }
          }

          let userAcceptedCard = false;
          if(project_l || project_r) {
            if(project_l) {
              userAcceptedCard = project_l.participants.find(p => p.status == 2) ? true : false;
            } else {
              userAcceptedCard = true;
            }
          }

          if(userAcceptedCard) {
            // find latest chat notification by projectId

            const firstNotificationByProjectId = chatNotifications.find(n => n.projectId == projectId);

            const searchedNotification = oldNotifications.find(n => n.projectId == projectId);

            totalNotification = totalNotification + 1;
            if(!searchedNotification) {
              allNotificationArr.push({...firstNotificationByProjectId, totalCount: counts[projectId]});
              this.newNotification = this.newNotification + 1;
            } else if(searchedNotification && firstNotificationByProjectId.recordId != searchedNotification.recordId) {
              allNotificationArr.push({...firstNotificationByProjectId, totalCount: counts[projectId]});
              this.newNotification = this.newNotification + 1;
            } else {
              if(!searchedNotification.isShown) {
                this.newNotification = this.newNotification + 1;
              }
              allNotificationArr.push({ ...firstNotificationByProjectId, totalCount: counts[projectId], isShown: (searchedNotification.isShown ? searchedNotification.isShown : false) });
            }
          }          
        }
      }

      if(allNotificationObj.comment) {
        const tempCommentNotifications = [];
        for(let notification of Object.keys(allNotificationObj.comment)) {
          let miliseconds = 0;
          const notificationObj: any = allNotificationObj.comment[notification];
          if (notificationObj.timestamp) {
            miliseconds = parseInt((notificationObj.timestamp.seconds * 1000).toString()) + parseInt((notificationObj.timestamp.nanoseconds / 1000000).toString());
          }

          tempCommentNotifications.push({...notificationObj, collection: 'comment', recordId: notification, miliseconds});
        }
        const commentNotifications = tempCommentNotifications.sort((a, b) => (a.miliseconds > b.miliseconds) ? -1 : 1).slice(0, 20);
        //console.log('commentNotifications', commentNotifications)
        const counts = commentNotifications.reduce((p, c) => {
          const taskId = c.taskId;
          if (!p.hasOwnProperty(taskId)) {
            p[taskId] = {
              count: 0,
              projectId: c.projectId
            };
          }
          p[taskId].count++;

          return p;
        }, {});

        //console.log('counts', counts)
        
        for(let taskId of Object.keys(counts)) {
          const project_l = this.store.selectSnapshot(CardsState.getProjectById(counts[taskId].projectId));

          let project_r = null;
          if (!project_l) {
            let response: any = await this.firebaseProjectService.getProjectById(counts[taskId].projectId, this.currentUser.userId);
            const docs = response.docs.map(doc => doc.data())
            if(docs.length > 0) {
              project_r = docs[0];
            }
          }

          let userAcceptedCard = false;
          if(project_l || project_r) {
            if(project_l) {
              userAcceptedCard = project_l.participants.find(p => p.status == 2) ? true : false;
            } else {
              userAcceptedCard = true;
            }
          }

          if(userAcceptedCard) {
            // find latest comment notification by taskId
            const firstNotificationByTaskId = commentNotifications.find(n => n.taskId == taskId);

            const searchedNotification = oldNotifications.find(n => n.taskId == taskId);

            totalNotification = totalNotification + 1;

            if(!searchedNotification) {
              allNotificationArr.push({...firstNotificationByTaskId, totalCount: counts[taskId].count});
              this.newNotification = this.newNotification + 1;
            } else if(searchedNotification && firstNotificationByTaskId.recordId != searchedNotification.recordId) {
              allNotificationArr.push({...firstNotificationByTaskId, totalCount: counts[taskId].count});
              this.newNotification = this.newNotification + 1;
            } else {
              if(!searchedNotification.isShown) {
                this.newNotification = this.newNotification + 1;
              }
              allNotificationArr.push({ ...firstNotificationByTaskId, totalCount: counts[taskId].count, isShown: (searchedNotification.isShown ? searchedNotification.isShown : false) });
            }
          }
        }
      }

      allNotificationArr.forEach(notification => {
        let miliseconds = notification['miliseconds'] ? notification['miliseconds'] : 0;
        let _timestamp = null;
        if (notification.timestamp) {
          if(!miliseconds) {
            miliseconds = parseInt((notification.timestamp.seconds * 1000).toString()) + parseInt((notification.timestamp.nanoseconds / 1000000).toString());
          }

          _timestamp = moment(miliseconds).calendar();
          if(_timestamp.indexOf('/') !== -1) {
            _timestamp =  moment(miliseconds).format("MMM D [at] h:mm a");
          }
        }
        notification['miliseconds'] = miliseconds;
        notification['_timestamp'] = _timestamp;
      });
      
      this.allNotification = allNotificationArr.sort((a, b) => (a.miliseconds > b.miliseconds) ? -1 : 1).slice(0, 20);
      this.totalNotification = totalNotification;
      //allNotificationArr = [...cardNotifications, ...chatNotifications, ...commentNotifications]
      //console.log(this.allNotification, this.newNotification);
      
      if(!this.isTabVisible()) {
        /*if(this.notificationState.chatUnread < this.totalChatsUnreaded && this.notificationState.notificationUnseen < this.newNotification) {
          document.title = 'Taskkey - New chat message + notification';
        } else if(this.notificationState.notificationUnseen < this.newNotification) {
          document.title = 'Taskkey - New notification';
        }*/
        if(this.notificationState.chatUnread < this.totalChatsUnreaded && this.notificationState.oldNotificationCount < this.totalNotification) {
          document.title = 'Taskkey - New chat message + notification';
        } else if(this.notificationState.oldNotificationCount < this.totalNotification) {
          document.title = 'Taskkey - New notification';
        }
      }
      
      window.localStorage.setItem(`taskkey_notification_${this.currentUser.userId}`, JSON.stringify(this.allNotification));
    });
  }

  openModalWithComponent() {
    this.modalRef = this.modalService.show(SettingsComponent);
  }

  acronym(name) {
    return name
      .split(/\s/)
      .reduce((accumulator, word) => accumulator + word.charAt(0), '');
  }

  toogleSideMenu() {
    this.appEventService.toogleSideMenu();
  }

  toogleCards() {
    //console.log(this.filterOption)
    this.appEventService.onClickCardFilter.next({value: this.filterOption});
  }

  openCreateCardPopup() {
    //this.appEventService.openCreateCardPopup.next();
    this.modalService.show(CreateCardComponent);
  }

  logOut() {
    if (this.firebaseProjectService.getAllProjectsSub) {
      this.firebaseProjectService.getAllProjectsSub.unsubscribe();
    }
    if (this.firebaseUserService.getAllParticipantsbyIdsSub) {
      this.firebaseUserService.getAllParticipantsbyIdsSub.unsubscribe();
    }
    this.firebaseTaskService.getTasksByProjectIdSubs.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.firebaseProjectService.allParticipantsSubs.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.firebaseProjectService.allParticipantsSubs = [];

    if(this.getNotificationSubs) {
      this.getNotificationSubs.unsubscribe();
    }
    try {
      const subs = this.firebaseUserService.setLoggedInState(false).subscribe(() => {
        subs.unsubscribe();
        const logOutAndClearNotification = this.ngFireFunctions.httpsCallable('logOutAndClearNotification');
        logOutAndClearNotification({}).subscribe((response) => {
          window.localStorage.setItem(`taskkey_notification_${this.currentUser.userId}`, JSON.stringify([]));
          this.authService.logout().then(res => {
            console.log('logout success!');
          }).catch(error => {
            console.log('error at google login: ', error);
          })
        });
      });
    } catch(e) {
      console.log(e)
      this.authService.logout().then(res => {
        console.log('logout success!');
      }).catch(error => {
        console.log('error at google login: ', error);
      })
    }
  }

  navigateToDashBoard() {
    this.router.navigateByUrl('/app/dashboard');
  }

  navigateToPlanner() {
    this.router.navigateByUrl('/app/planner');
  }

  navigateToArchive() {
    this.router.navigateByUrl('/app/archive');
  }

  operateChatBox () {
    this.appEventService.toggleChatBoxView(!this.chatBoxOpened)
    this.chatBoxOpened = true
  }

  toggleNotificationBoxView () {
    this.showNotificationBox = !this.showNotificationBox;
    const notificationState = {
      isOpen: this.showNotificationBox,
      count: this.newNotification
    }
    this.appEventService.toggleNotificationBoxView(notificationState);
  }

  applyStateChange (data) {
    this.chatBoxViewer = data
  }

  toogleUserState() {
    console.log(this.isOnline);
    this.firebaseUserService.setOnlineState(this.isOnline).subscribe(() => {
      console.log('Online state changed to ' + this.isOnline);
    });
  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
    this.subscription.unsubscribe();
    if (this.firebaseProjectService.getAllProjectsSub) {
      this.firebaseProjectService.getAllProjectsSub.unsubscribe();
    }
    if(this.getNotificationSubs) {
      this.getNotificationSubs.unsubscribe();
    }

    document.removeEventListener(this.eventKey, this.tabVisibilityChangeHandler);
  }

}
