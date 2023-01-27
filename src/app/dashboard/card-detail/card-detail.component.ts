import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as moment from 'moment';

import { Store, Select } from '@ngxs/store';
import { Subject, Observable, Subscription } from 'rxjs';
import { takeUntil, filter, map } from 'rxjs/operators';

import { SetSelectedProjectAllParticipants } from 'src/app/stateManagement/cards/cards.action';
import { CardsState } from './../../stateManagement/cards/cards.state';
import { FirebaseUserService } from '../../services/firebaseUser.service';
import { AngularFirestore } from '@angular/fire/firestore';
import { FirebaseFileService } from '../../services/firebaseFile.service';
import { FirebaseProjectService } from '../../services/firebaseProject.service';
import { FirebaseTaskService } from '../../services/firebaseTask.service';
import { AppEventService } from '../../services/event.service';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { CreateCardComponent } from '../create-card/create-card.component';
import { ArchiveCardComponent } from '../archive-card/archive-card.component';
import { ACTIVITY_IDENTIFIER } from '../../interfaces/activity.identifiers';

@Component({
  selector: 'app-card-detail',
  templateUrl: './card-detail.component.html',
  styleUrls: ['./card-detail.component.scss']
})
export class CardDetailComponent implements OnInit, OnDestroy {
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();

  fileStats = {
    total: 0,
    new: 0
  }
  tasksStats = {
    assigned: 0,
    pending: 0,
    completed: 0,
    totalPending: 0,
    totalCompleted: 0
  }
  getFilesByProjectIdSub: Subscription;
  getTasksByProjectIdSub: Subscription;
  fileStatsSub: Subscription;
  getCardSub: Subscription;
  getActivitiesSub: Subscription;

  projectId: string = '';
  taskId: string = '';

  dataLoadedOnLoad = false;
  card: any;

  public selectedIndex = 0;
  public selectedOpIndex = 0;
  public appPages = [
    {
      title: 'Tasks',
      url: 'tasks'
    },
    {
      title: 'Notes',
      url: 'notes'
    },
    {
      title: 'Files',
      url: 'files'
    }
  ];
  public cardActionPages = [
    {
      title: 'Edit Card'
    },
    {
      title: 'Archive Card'
    }
  ]
  currentUser = null;
  activities: any[] = [];
  allParticipant: any[] = [];
  public note: Number = 0
  public readNote: Number = 0
  public adminRole: any;
  public cardFilterType = 'active';
  isEmpty = false;
  filterString = '';
  editCardStarted = false;
  showRecentLoading = false;

  constructor(
    private store: Store,
    private firebaseUserService: FirebaseUserService,
    private appEventService: AppEventService,
    private ngFirestore: AngularFirestore,
    private firebaseFileService: FirebaseFileService,
    private route: ActivatedRoute,
    private firebaseProjectService: FirebaseProjectService,
    private firebaseTaskService: FirebaseTaskService,
    private modalService: BsModalService
  ) {
    this.appEventService.toogleNoNewCardViewEmitter.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((data) => {
      this.cardFilterType = data.filterType;
      this.isEmpty = data.show;
    });
    this.appEventService.closeCreateCardEmitter.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((data) => {
      this.editCardStarted = false;
    });
    const subs = this.firebaseUserService.getCurrentUser().subscribe(async (userData) => {
      subs.unsubscribe();
      this.currentUser = userData;
      if(this.dataLoadedOnLoad) {
        this.setFileStats();
        this.setTaskStats();
        this.setNotesStats()
        this.adminRole = await this.checkUserIsAdminOrParticipant(userData.data().userId)
      }
    }, err => {
      subs.unsubscribe();
      console.log(err);
    });
    this.route.params.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(async params => {
      this.projectId = params['projectId'];
      this.taskId = params['taskId'] ? params['taskId'] : '';
      if (this.dataLoadedOnLoad) {
        this.loadData();
        this.selectedIndex = 0
        this.selectedOpIndex = 0
        this.setFileStats();
        this.setTaskStats();
        this.setNotesStats()
        this.adminRole = await this.checkUserIsAdminOrParticipant(this.currentUser.userId);
        this.activities = [];
      }
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
          setTimeout(async () => {
            this.loadData();
            if(this.currentUser) {
              this.setFileStats();
              this.setTaskStats();
              this.setNotesStats()
              this.adminRole = await this.checkUserIsAdminOrParticipant(this.currentUser.userId)
            }
          }, 0);
        }
      }, err => {
        console.log(err)
        this.dataLoadedOnLoad = true;
        try {
          if(subscription) {
            subscription.unsubscribe();
          }
        } catch (e) {
          console.log(e)
        }
      });
  }

  loadData() {
    if(this.getCardSub) {
      this.getCardSub.unsubscribe();
    }
    this.getCardSub = this.store.select(CardsState.getProjectById(this.projectId)).subscribe(async (card) => {
      this.card = card;
      if(card) {
        if(this.firebaseUserService.getAllParticipantsbyIdsSub) {
          this.firebaseUserService.getAllParticipantsbyIdsSub.unsubscribe();
        }
        const allParticipant = [];
        for(let participant of card.participants) {
          const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(participant.id)
          allParticipant.push({ ...user, admin: participant.admin, status: participant.status});
        }
        this.allParticipant = allParticipant;
        //this.store.dispatch(new SetSelectedProjectAllParticipants(allParticipant));
        //this.firebaseProjectService.selectedProjectParticipants = this.allParticipant;
        
        this.dataLoadedOnLoad = true;
        if(this.currentUser) {
          this.adminRole = await this.checkUserIsAdminOrParticipant(this.currentUser.userId);
          if(!this.adminRole && this.editCardStarted) {
            this.modalService.hide();
          }
        }
      }
    });

    if(this.getActivitiesSub) {
      this.getActivitiesSub.unsubscribe();
    }
    this.getActivitiesSub = this.ngFirestore.collection('projects').doc(this.projectId).collection('activities').snapshotChanges().subscribe(async (activitiesData) => {
      this.showRecentLoading = true;
      const activities = [];
      for(let activity of activitiesData) {
        if (activity.payload.doc) {
          const data = activity.payload.doc.data() as any;
          const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(data.createdBy)

          let miliseconds = 0;
          let timestamp = null;
          if (data.timestamp) {
            miliseconds = parseInt((data.timestamp.seconds * 1000).toString()) + parseInt((data.timestamp.nanoseconds / 1000000).toString());

            timestamp = moment(miliseconds).calendar();
            if(timestamp.indexOf('/') !== -1) {
              timestamp =  moment(miliseconds).format("MMM D [at] h:mm a");
            }
          }

          const messageHTML = await this.createMessageStr(data, user);
          activities.push({...data, messageHTML, miliseconds, timestamp});
        }
      }
      this.activities = activities.sort((a, b) => (a.miliseconds > b.miliseconds) ? -1 : 1);
      this.showRecentLoading = false;
      //console.log(this.activities)
      //this.mapHTMLToActivity();
    });
  }

  mapHTMLToActivity() {
    this.activities.forEach(async activity => {
      const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(activity.createdBy)
      this.createMessageStr(activity, user);
    })
  }

  async createMessageStr(activity, p_user) {
    let messageHTML = `<span>${p_user.name}:</span>`;
    if(activity.activityIdentifier == ACTIVITY_IDENTIFIER.CARD_CREATED) {
      messageHTML += ` Created this card`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.CARD_RENAMED) { // Test
      const name = activity.title.split(',');
      messageHTML += ` Renamed card to <span>${name[1]}</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.CARD_CHANGED_DESCRIPTION) {
      const name = activity.title.split(',');
      messageHTML += ` ${activity.action} <span>${name[0]}</span> to <span>${name[1]}</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.CARD_ARCHIVED) {
      messageHTML += ` ${activity.action} this card`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.CARD_USER_INVITED) {
      const userIds = activity.title.split(',');
      messageHTML += ` Invited`;
      for(let userId of userIds) {
        const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(userId.trim());
        if(user.name) {
          messageHTML += ` <span>${user.name}</span>,`;
        } else {
          messageHTML += ` <span>${userId.trim()}</span>,`;
        }
      }
      messageHTML = messageHTML.substring(0, messageHTML.length-1);
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.CARD_USER_REMOVED) {
      const userIds = activity.title.split(',');
      messageHTML += ` Removed`;
      for(let userId of userIds) {
        const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(userId.trim());
        if(user.name) {
          messageHTML += ` <span>${user.name}</span>,`;
        } else {
          messageHTML += ` <span>${userId.trim()}</span>,`;
        }
      }
      messageHTML = messageHTML.substring(0, messageHTML.length-1);
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.CARD_USER_ACCEPTED) {
      messageHTML += ` Accepted invite`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.CARD_USER_DECLINED) {
      messageHTML += ` Declined invite`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.CARD_USER_LEFT) {
      messageHTML += ` Dismissed card`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.CARD_ADMIN_ADDED) {
      messageHTML += ` Added`;
      const userIds = activity.title.split(',');
      for(let userId of userIds) {
        const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(userId.trim());
        if(user.name) {
          messageHTML += ` <span>${user.name}</span>,`;
        } else {
          messageHTML += ` <span>${userId.trim()}</span>,`;
        }
      }
      messageHTML = messageHTML.substring(0, messageHTML.length-1);
      messageHTML += ` to Admin group`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.CARD_ADMIN_REMOVED) {
      messageHTML += ` Removed`;
      const userIds = activity.title.split(',');
      for(let userId of userIds) {
        const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(userId.trim());
        if(user.name) {
          messageHTML += ` <span>${user.name}</span>,`;
        } else {
          messageHTML += ` <span>${userId.trim()}</span>,`;
        }
      }
      messageHTML = messageHTML.substring(0, messageHTML.length-1);
      messageHTML += ` from Admin group`;


    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.TASK_CREATED) {
      messageHTML += ` Created task - <span>${activity.title}</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.TASK_COMPLETED) {
      messageHTML += ` Updated status on <span>${activity.title}</span> to <span>complete</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.TASK_INCOMPLETED) {
      messageHTML += ` Updated status on <span>${activity.title}</span> to <span>incomplete</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.TASK_RENAMED) {
      const name = activity.title.split(',');
      messageHTML += ` Renamed task to <span>${name[1]}</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.TASK_DELETED) {
      messageHTML += ` Deleted task - <span>${activity.title}</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.TASK_REQUEST_UPDATE) {
      messageHTML += ` Requested updated for task - <span>${activity.title}</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.TASK_STARTED) {
      messageHTML += ` Updated status on <span>${activity.title}</span> to <span>in-progress</span>`;


    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.NOTE_CREATED) {
      messageHTML += ` Created note - <span>${activity.title}</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.NOTE_RENAMED) {
      const name = activity.title.split(',');
      messageHTML += ` Renamed note to <span>${name[1]}</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.NOTE_DELETED) {
      messageHTML += ` Deleted note - <span>${activity.title}</span>`;



    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.FILE_UPLOADED) {
      messageHTML += ` Uploaded file - <span>${activity.title}</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.FILE_MULTIPLE_UPLOADED) {
      messageHTML += ` Uploaded <span>${activity.title}</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.FILE_RENAMED) {
      const name = activity.title.split(',');
      messageHTML += ` Renamed file to <span>${name[1]}</span>`;
    } else if (activity.activityIdentifier == ACTIVITY_IDENTIFIER.FILE_DELETED) {
      messageHTML += ` Deleted file - <span>${activity.title}</span>`;
    } else {
      messageHTML += ` ${activity.action}`;
    }
    return messageHTML;
  }

  setFileStats() {
    if(this.getFilesByProjectIdSub) {
      this.getFilesByProjectIdSub.unsubscribe();
    }
    this.getFilesByProjectIdSub = this.firebaseFileService.getAndListenAllFilesById(this.projectId).subscribe((files) => {
      const allFiles = files;
      
      let newFile = 0;
      allFiles.forEach(file => {
        if(!file.readStatus || !file.readStatus[this.currentUser.userId]) {
          newFile = newFile + 1;
        }
      });
  
      this.fileStats = {
        total: allFiles.length,
        new: newFile
      }
    });
    
  }

  setNotesStats(){
    this.firebaseProjectService.getNotesCount(this.projectId, false).subscribe(res => {
      this.note = res.length
    })
    this.firebaseProjectService.getNotesCount(this.projectId, true).subscribe(res => {
      this.readNote = res.length
    })
  }

  setTaskStats() {
    if(this.getTasksByProjectIdSub) {
      this.getTasksByProjectIdSub.unsubscribe();
    }
    this.getTasksByProjectIdSub = this.firebaseTaskService.getAndListenAllTaskById(this.projectId).subscribe((tasks) => {
      const assignedTasks = tasks.filter(task => task.participants && task.participants[this.currentUser.userId]);
      let pendingCount = 0;
      let completedCount = 0;
      let pendingTasks = 0;
      let completedTasks = 0;

      const totalTask = tasks.forEach(task => {
        if(!task.completed) {
          pendingTasks = pendingTasks + 1;
        } else {
          completedTasks = completedTasks + 1
        }
      });

      assignedTasks.forEach((task) => {
        if(!task.completed) {
          pendingCount = pendingCount + 1;
        } else {
          completedCount = completedCount + 1
        }
      });

      this.tasksStats = {
        assigned: assignedTasks.length,
        pending: pendingCount,
        completed: completedCount,
        totalPending: pendingTasks,
        totalCompleted: completedTasks
      }
    });
  }

  cardAction(item, card) {
    if(item.title === 'Edit Card') {
      const initialState: any = {
        selectedCard: card
      };
      this.modalService.show(CreateCardComponent, {initialState});
    } else if(item.title === 'Archive Card') {
      const initialState: any = {
        projectId: this.projectId,
        userId: this.currentUser.userId
      };
      this.modalService.show(ArchiveCardComponent, {
        class: 'modal-dialog-centered',
        initialState  
      });
    }
  }

  checkUserIsAdminOrParticipant(userId) {
    return new Promise((resolve, reject) => {
      const card = this.store.selectSnapshot(CardsState.getProjectById(this.projectId));
      if(card) {
        const pUser = card.participants.find(p => p.id == userId)
        if(card.createdBy == userId || (pUser && pUser.admin)) {
          return resolve(true);
        } else {
          return resolve(false);
        }
      } else {
        return resolve(false);
      }
    })
  }

  archiveCard(card) {
    const initialState: any = {
      projectId: this.projectId,
      userId: this.currentUser.userId
    };
    this.modalService.show(ArchiveCardComponent, {
      class: 'modal-dialog-centered',
      initialState  
    });
  }

  setFilterForTask(filterArg) {
    this.selectedIndex = 0
    this.appEventService.sendTaskFilterString(filterArg)
  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
    if(this.firebaseUserService.getAllParticipantsbyIdsSub) {
      this.firebaseUserService.getAllParticipantsbyIdsSub.unsubscribe();
    }
    if(this.fileStatsSub) {
      this.fileStatsSub.unsubscribe();
    }
    if(this.getCardSub) {
      this.getCardSub.unsubscribe();
    }
    if(this.getActivitiesSub) {
      this.getActivitiesSub.unsubscribe();
    }
    if(this.getFilesByProjectIdSub) {
      this.getFilesByProjectIdSub.unsubscribe();
    }
  }

}
