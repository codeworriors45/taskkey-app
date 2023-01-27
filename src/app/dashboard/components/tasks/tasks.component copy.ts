import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AngularFirestore } from '@angular/fire/firestore';
import { Store } from '@ngxs/store';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { takeUntil, filter, switchMap } from 'rxjs/operators';
import * as moment from 'moment';
import { AngularFireFunctions } from '@angular/fire/functions';
import { AngularFireAuth } from '@angular/fire/auth';

import { TIMELINE_IDENTIFIER } from '../../../interfaces/timeline-identifier.interface'
import { CardsState } from '../../../stateManagement/cards/cards.state';
import { FirebaseUserService } from '../../../services/firebaseUser.service';
import { FirebaseProjectService } from '../../../services/firebaseProject.service';
import { FirebaseTaskService } from '../../../services/firebaseTask.service';
import { CryptoService } from '../../../services/crypto.service';
import { ActivitylogsService } from 'src/app/services/activitylogs.service';
import { ACTION_MAPPER, ACTION_TITLE_MAPPER } from '../../../interfaces/activity.action'
import { ACTIVITY_IDENTIFIER } from '../../../interfaces/activity.identifiers'
import { AppEventService } from '../../../services/event.service';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.scss']
})
export class TasksComponent implements OnInit, OnDestroy {
  @Input() projectId: string = '';
  @Input() taskId: string = '';
  @Input() filterString: String = ''
  pageRefreshed = false;
  @ViewChild('operationDropdownPopup') operationDropdownPopup: ElementRef;
  @ViewChild('commentInput') commentInput: ElementRef;
  @ViewChild('toDoInput') toDoInput: ElementRef;
  @ViewChild('commentContainers') commentContainers: ElementRef;
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  selectedProjectAllParticipants: any[] = [];

  currentUser: any;
  rsaDecryptKey: any;
  AES_SecretKeyCreated = false;

  card: any;
  tasks: any[] = [];
  comments: any[];
  toDos: any[] = [];
  events: any[] = [];
  //dataLoadedOnLoad = false;
  filteredTasks: any[] = [];
  selectedTab = 0;
  selectedTask: any;
  
  loadDataSubs: Subscription;
  getParticipantSubs: Subscription;
  commentSubs: Subscription;
  toDosSubs: Subscription;
  eventsSubs: Subscription;

  sortBy = '';
  sortOrder = 1;

  filterOptions = {
    updateRequest: [],
    status: ['pending', 'in-progress', 'overdue', 'completed'],
    participants: []
  };
  taskCallToAction = [];
  taskStatusArr = ['pending', 'in-progress', 'overdue', 'completed'];
  filterApplied = false;

  typingTimer: any;
  getCommentTimer: any;
  
  newComment = '';
  replingTo = {
    parentCommentId: '',
    repliedCommentId: '',
    userName: '',
    firebaseReplies: {}
  };
  replyInputFiledCleared = true;
  
  newToDo = '';

  taskForm: FormGroup;
  formSubmitted = false;
  minDate = new Date();

  searchStr = '';
  searchedUsersArr = [];
  public involvedPersonsKey: Map<String, Object> = new Map();

  taskObj_beforeUpdate: any = {};

  constructor(
    private store: Store,
    private router: Router,
    private afAuth: AngularFireAuth,
    private ngFirestore: AngularFirestore,
    private ngFireFunctions: AngularFireFunctions,
    private firebaseProjectService: FirebaseProjectService,
    private firebaseUserService: FirebaseUserService,
    private firebaseTaskService: FirebaseTaskService,
    private cryptoService: CryptoService,
    private formBuilder: FormBuilder,
    private activitylogsService: ActivitylogsService,
    private appEventService: AppEventService
  ) {
    /*const currentUrl = this.router.url;
    if(currentUrl.indexOf('app/dashboard/c/') != -1) {
      const foundAt = currentUrl.indexOf('/c/');
      this.projectId = currentUrl.slice(foundAt+3);
    }*/
    this.initForm();
    //this.searchUserCallable = this.ngFireFunctions.httpsCallable('searchUser');

    const subs = this.firebaseUserService.getCurrentUser().subscribe((userData) => {
      subs.unsubscribe();
      this.currentUser = userData.data();
      this.getTaskSecretKey();
      this.loadData();
    }, err => {
      subs.unsubscribe();
      console.log(err);
    })

    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntil(this.subscriptionDestroyed$)).subscribe((endUrl: NavigationEnd) => {
      const currentUrl = endUrl.urlAfterRedirects;
      if (currentUrl.indexOf('app/dashboard/c/') != -1) {
        const foundAt = currentUrl.indexOf('/c/');
        if(currentUrl.indexOf('/t/') == -1) {
          this.projectId = currentUrl.slice(foundAt+3);
        } else {
          const index = currentUrl.indexOf('/t/');
          this.projectId = currentUrl.slice(foundAt+3, index);
        }
      }
      if (currentUrl.indexOf('/t/') != -1) {
        const foundAt = currentUrl.indexOf('/t/');
        this.taskId = currentUrl.slice(foundAt + 3);
      } else {
        this.taskId = '';
      }
      //Maked sure parent component loaded first so comment following code
      /*if (this.dataLoadedOnLoad) {
        this.loadData();
      }*/
      this.AES_SecretKeyCreated = false;
      this.setSelectedTask(undefined);
      this.getTaskSecretKey();
      this.loadData();
    });
    this.appEventService.filterTaskEmiiter.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((data) => {
      this.filterString = data
      this.filterationBasedOnStatClick()
    });
  }

  ngOnInit(): void {
    //Maked sure parent component loaded first so commented following code
    /*const subscription = this.store
      .select((x) => x.home)
      .subscribe((home) => {
        if (home.loadedInitialUserData) {
          this.loadData();
          subscription.unsubscribe();
        }
      }, err => {
        console.log(err)
        this.dataLoadedOnLoad = true;
        subscription.unsubscribe();
      });*/
    //this.loadData();
  }

  ngOnChanges() {
  }

  initForm() {
    this.taskForm = this.formBuilder.group({
      id: new FormControl(''),
      name: new FormControl('', {
        validators: [Validators.required],
      }),
      dueDate_DB: new FormControl(null),
      description: new FormControl(''),
      callToAction: new FormControl(false),
      completed: new FormControl(false),
      createdBy: new FormControl(''),
      isStarted: new FormControl(false),
      projectId: new FormControl(''),
      //participants_DB: new FormControl(null),
      readStatus: new FormControl(null),
      timestamp_DB: new FormControl(null)
    });
  }

  loadData() {
    //console.log('loadData()............Called');
    this.pageRefreshed = true;
    this.card = this.store.selectSnapshot(CardsState.getProjectById(this.projectId));

    if (this.getParticipantSubs) {
      this.getParticipantSubs.unsubscribe();
    }
    this.getParticipantSubs = this.store.select(CardsState.getParticipants()).subscribe((participants) => {
      setTimeout(() => {
        if(!this.pageRefreshed) {
          const mappedParticipants = participants.map((participant) => {
            const searchedParticipant = this.filterOptions.participants.find(p => p.userId == participant.userId)
            const profileImage = participant.profileImage ? participant.profileImage : `assets/images/user${this.getRandomInt()}.png`;
            return {...participant, profileImage, selected: searchedParticipant ? searchedParticipant.selected : false};
          });
          const joinedParticipants = []
          mappedParticipants.forEach(participant => {
            if(participant.status == 2) {
              joinedParticipants.push(participant);
            }
          });
          this.selectedProjectAllParticipants = [...joinedParticipants];
          this.filterOptions.participants = [...joinedParticipants];
          this.filterTasks();
        } else {
          const mappedParticipants = participants.map((participant) => {
            const profileImage = participant.profileImage ? participant.profileImage : `assets/images/user${this.getRandomInt()}.png`;
            return {...participant, selected: false, profileImage};
          })
          const joinedParticipants = []
          mappedParticipants.forEach(participant => {
            if(participant.status == 2) {
              joinedParticipants.push(participant);
            }
          });
          this.selectedProjectAllParticipants = [...joinedParticipants];
          this.filterOptions.participants = [...joinedParticipants];
          this.filterOptions.status = [];
          this.filterApplied = false;
        }
  
        this.filteredTasks.forEach(task => {
          const createdBy = this.selectedProjectAllParticipants.find((participant) => participant.userId == task.createdBy);
          if(createdBy) {
            const fullName = createdBy.name + (createdBy.lastName && createdBy.lastName != '' ? ' ' + createdBy.lastName : '');
            task._createdBy = fullName.trim();
          } else {
            task._createdBy = '';
          }

          task.participants.forEach(p => {
            const p_toMapProfileImg = this.selectedProjectAllParticipants.find((participant) => participant.userId == p.id);
            p.profileImage = p_toMapProfileImg && p_toMapProfileImg.profileImage ? p_toMapProfileImg.profileImage : `assets/images/user${this.getRandomInt()}.png`;
          });

        })
        this.pageRefreshed = false;
      }, 0);
    });

    if (this.loadDataSubs) {
      this.loadDataSubs.unsubscribe();
    }
    this.loadDataSubs = this.firebaseTaskService.getAndListenAllTaskById(this.projectId).subscribe((tasks) => {
      //console.log('loadData............');
      const mappedTasks = tasks.map((task) => {
        let dueDate = 0;
        if(task.dueDate) {
            dueDate = parseInt((task.dueDate.seconds*1000).toString()) + parseInt((task.dueDate.nanoseconds/1000000).toString())
        }
        
        const currentUserInTaskParticipant = task.participants ? task.participants[this.currentUser.userId] : undefined;
        let unreadMsg = currentUserInTaskParticipant ? currentUserInTaskParticipant.unreadMsg : 0;

        const participantsArr = [];
        for (const participantId in task.participants) {
          const p_toMapProfileImg = this.selectedProjectAllParticipants.find((participant) => participant.userId == participantId);
          const user = task.participants[participantId];
          const profileImage = p_toMapProfileImg && p_toMapProfileImg.profileImage ? p_toMapProfileImg.profileImage : `assets/images/user${this.getRandomInt()}.png`;
          participantsArr.push({...user, profileImage});
        }

        let status = 'pending';
          if(task.completed) {
              status =  'completed';
          } else if(dueDate) {
            const dueDate_temp = new Date(dueDate);
            const dueDateObj = new Date(dueDate_temp.getFullYear(), dueDate_temp.getMonth(), dueDate_temp.getDate());
            const currentDate_temp = new Date();
            const currentDate = new Date(currentDate_temp.getFullYear(), currentDate_temp.getMonth(), currentDate_temp.getDate());
            if(currentDate.getTime() > dueDateObj.getTime()) {
              status =  'overdue';
            } else if(task.isStarted) {
              status = 'in-progress';
            }
          } else if(task.isStarted) {
            status = 'in-progress';
          }

        let statusForSorting = 0;
        if(status == 'pending') {
          statusForSorting = 1;
        }
        if(status == 'in-progress') {
          statusForSorting = 2;
        }
        if(status == 'overdue') {
          statusForSorting = 3;
        }
        if(status == 'completed') {
          statusForSorting = 4;
        }

        let miliseconds = 0;
        if (task.timestamp && task.timestamp.seconds) {
          miliseconds = parseInt((task.timestamp.seconds * 1000).toString()) + parseInt((task.timestamp.nanoseconds / 1000000).toString());
        }

        const createdBy = this.selectedProjectAllParticipants.find((participant) => participant.userId == task.createdBy);
        if(createdBy) {
          const fullName = createdBy.name + (createdBy.lastName && createdBy.lastName != '' ? ' ' + createdBy.lastName : '');
          return {...task, status, unreadMsg, participants: participantsArr, dueDate, _createdBy: fullName.trim(), statusForSorting, timestamp: miliseconds}
        } else {
          return {...task, status, unreadMsg, participants: participantsArr, dueDate, _createdBy: '', statusForSorting, timestamp: miliseconds}
        }
      });

      this.tasks = [...mappedTasks];
      this.filteredTasks = [...mappedTasks];

      this.filterTasks();
      if(this.filteredTasks.length > 0) {
        if(this.taskId !== '' && this.selectedTask == undefined) {
          this.setSelectedTask(this.filteredTasks.find(task => task.id == this.taskId))
        } else if(this.taskId == '' && this.selectedTask == undefined) {
          if(this.filteredTasks.length > 0) {
            this.setSelectedTask(this.filteredTasks[0]);
          }
        }
      }

      if(this.selectedTask) {
        let selectedTaskDeleted = true;
        this.tasks.forEach(task => {
          if(task.id == this.selectedTask.id) {
            this.selectedTask.name = task.name;
            this.selectedTask.dueDate = task.dueDate;
            this.selectedTask.status = task.status;
            this.selectedTask.completed = task.completed;
            this.selectedTask.isStarted = task.isStarted;
            this.selectedTask.callToAction = task.callToAction;

            selectedTaskDeleted = false;
          }
        });
        if(selectedTaskDeleted) {
          this.setSelectedTask(null);
        }
      }
      //console.log(this.filteredTasks)
    });
    
  }

  setSelectedTask(task) {
    this.selectedTask = task;
    this.selectedTab = 0;
    this.taskId = '';

    if(!this.selectedTask) {
      this.comments = [];
      this.toDos = [];
      this.events = [];
      if (this.commentSubs) {
        this.commentSubs.unsubscribe();
      }
      if (this.toDosSubs) {
        this.toDosSubs.unsubscribe();
      }
      if (this.eventsSubs) {
        this.eventsSubs.unsubscribe();
      }
    } else {
      if(this.AES_SecretKeyCreated) {
        this.getComments();
      }
      this.getTodos();
      this.getEvents();
    }

    setTimeout(() => {
      if(this.commentInput) {
        this.clearReplyingToUI();
      }
      if(this.toDoInput) {
        this.newToDo = '';
        this.toDoInput.nativeElement.innerText = '';
        this.toDoInput.nativeElement.innerHTML = '';
      }
    }, 0);
  }

  getTaskSecretKey() {
    const project = this.store.selectSnapshot(CardsState.getProjectById(this.projectId));

    const userParticipant = project.participants.find((participant) => this.currentUser.userId == participant.id);

    let taskSecretKey = this.ngFireFunctions.httpsCallable('getTaskSecretKey');

    taskSecretKey({secret: userParticipant.secret, publicKey: this.cryptoService.rsaKeyGeneration.rsaPublicKey}).subscribe(async (response) => {
      this.rsaDecryptKey =  await this.cryptoService.rsaKeyGeneration.decrypt(response);
      if(this.selectedTask) {
        this.getComments();
      }
      this.AES_SecretKeyCreated = true;
    });
  }

  getRandomInt() {
    return Math.floor(Math.random() * Math.floor(3)) + 1;
  }

  preventClose(event: MouseEvent) {
    event.stopImmediatePropagation();
  }

  openFiletrDropDown(filterDropdown) {
    const mappedParticipants = this.selectedProjectAllParticipants.map(partipant => {
      const searchedParticipant = this.filterOptions.participants.find(f_partipant => f_partipant.userId == partipant.userId);
      return {...searchedParticipant, selected: searchedParticipant.selected ? true : false}
    })
    this.selectedProjectAllParticipants = [...mappedParticipants];
    this.taskStatusArr = [...this.filterOptions.status];
    this.taskCallToAction = [...this.filterOptions.updateRequest];
    filterDropdown.show();
  }

  applyFiletrDropDown() {
    const mappedParticipants = this.filterOptions.participants.map(f_partipant => {
      const searchedParticipant = this.selectedProjectAllParticipants.find(partipant => f_partipant.userId == partipant.userId);
      return {...searchedParticipant, selected: searchedParticipant.selected ? true : false}
    })
    this.filterOptions.participants = [...mappedParticipants];
    this.filterOptions.status = [...this.taskStatusArr];
    this.filterOptions.updateRequest = [...this.taskCallToAction];
    //console.log(this.filterOptions)
    this.filterTasks();
    this.filterApplied = true;
    this.filterString = ''
  }

  filterTasks() {
    this.filteredTasks = this.tasks.filter((task) => {
      let participantFoundInFilter = false;

      const selectedParticipantInFilterOpt = this.filterOptions.participants.filter(participant => participant.selected);

      selectedParticipantInFilterOpt.forEach(filterParticipant => {
        if(filterParticipant.selected) {
          task.participants.forEach(taskParticipant => {
            //console.log(taskParticipant, filterParticipant)
            if(taskParticipant.id == filterParticipant.userId) {
              participantFoundInFilter = true;
            }
          })
        }
      });
      if(selectedParticipantInFilterOpt.length == 0) {
        participantFoundInFilter = true;
      }

      let filteredByUpdateRequest = true;
      if(this.filterOptions.updateRequest.length == 1) {
        const filterby = this.filterOptions.updateRequest[0] == 'active'? true : false;
        if(task.callToAction != filterby) {
          filteredByUpdateRequest = false;
        }
      }

      return (this.filterOptions.status.length > 0 ? this.filterOptions.status.indexOf(task.status) != -1 : true) && participantFoundInFilter && filteredByUpdateRequest;
    });
    this.sortTasks();
  }

  resetFilterDropDown() {
    const mappedParticipants = this.selectedProjectAllParticipants.map((participant) => {
      return {...participant, selected: false};
    });
    this.selectedProjectAllParticipants = [...mappedParticipants];
    this.filterOptions.participants = [...mappedParticipants];
    this.filterOptions.status = [];
    this.filterOptions.updateRequest = [];
    this.taskStatusArr = ['pending', 'in-progress', 'overdue', 'completed'];
    this.taskCallToAction = [];
    this.filteredTasks = this.tasks;
    this.filterApplied = false;
    this.filterString = ''
    this.sortTasks();
  }

  toogleSelectedStatusForFilter(status) {
    const index = this.taskStatusArr.indexOf(status);
    if(index == -1) {
      this.taskStatusArr.push(status)
    } else {
      this.taskStatusArr.splice(index, 1);
    }
  }

  toogleUpdateRequestForFilter(value) {
    const index = this.taskCallToAction.indexOf(value);
    if(index == -1) {
      this.taskCallToAction.push(value)
    } else {
      this.taskCallToAction.splice(index, 1);
    }
  }

  sortTasks() {
    let sortBy = this.sortBy;
    if(sortBy == '') {
      sortBy = 'dueDate';
    }
    if(sortBy == 'createdBy') {
      sortBy = '_createdBy';
    }

    if(sortBy == 'status') {
      sortBy = 'statusForSorting';
    }

    this.filteredTasks.sort((a,b) => {
      //if (a[sortBy] < b[sortBy]) return -1
      //return a[sortBy] > b[sortBy] ? 1 : 0

      let result = (a[sortBy] < b[sortBy]) ? -1 : (a[sortBy] > b[sortBy]) ? 1 : 0;
      return result * this.sortOrder;
    });
    //console.log(this.sortOrder, this.sortBy, this.filteredTasks);
    //if(this.sortOrder != 1) {
      //this.filteredTasks.reverse();
    //}
  }

  toogleSortOrder() {
    this.sortOrder = -1 * this.sortOrder;
    this.sortTasks();
  }

  getParticipantById(userId) {
    return new Promise((resolve, reject) => {
      const user = this.selectedProjectAllParticipants.find(participant => participant.userId == userId);
      if (user) {
        resolve(user)
      } else {
        this.ngFirestore.collection('users').doc(userId).get().subscribe(res => {
          resolve(res.data())
        })
      }
    }) 
  }

  getParticipantFullNameById(userId) {
    console.log('--------getParticipantFullNameById----------')
    const user = this.selectedProjectAllParticipants.find(participant => participant.userId == userId)
    return user.name + (user.lastName && user.lastName != '' ? ' ' + user.lastName : '');
  }

  getComments() {
    //console.log('getComments---------')
    let loadedCommentOnTaskClickOrPageLoad = true;
    if (this.selectedTask) {   
      if (this.commentSubs) {
        this.commentSubs.unsubscribe();
      }   
      this.commentSubs = this.ngFirestore.collection('projectsTasks').doc(this.selectedTask.id).collection('comments').snapshotChanges().subscribe((commentsData) => {
        //console.log('-------------commentSubs----------', this.selectedTask.id)
        this.comments = [];
        let comments = commentsData.map(comment => {
          //console.log(comment.type)
          if (comment.payload.doc) {
            const data = comment.payload.doc.data() as any;
            //console.log(comment.payload.doc.data())
            const id = comment.payload.doc.id;
            //const exists = comment.payload.doc.exists;
            let replies = [];
            if (data.replies) {
              for (const replyId in data.replies) {
                //replies.push(data.replies[replyId]);
                let reply = {...data.replies[replyId]};

                if(reply.comment) {
                  let decryptedComment = '';
                if(this.rsaDecryptKey) {
                  reply.comment  = reply.comment.replace(/\n/g, "");
                  decryptedComment = this.cryptoService.decryptData(reply.comment, this.rsaDecryptKey);
                  decryptedComment = this.mapPartiCipantIdInComments(decryptedComment);
                  decryptedComment = decryptedComment.replace(/\n/g, "<br />");
                  //console.log(decryptedComment)
                }

                let timestamp = null;
                let miliseconds = 0;
                if (reply.timestamp) {
                  miliseconds = parseInt((reply.timestamp.seconds * 1000).toString()) + parseInt((reply.timestamp.nanoseconds / 1000000).toString());
                  
                  timestamp = moment(miliseconds).calendar();
                  if(timestamp.indexOf('/') !== -1) {
                    timestamp =  moment(miliseconds).format("MMM D [at] h:mm a");
                  }
                }

                const parentCommentUsername = '';
                if (this.selectedProjectAllParticipants.length > 0) {
                  const user = this.selectedProjectAllParticipants.find(participant => participant.userId == reply.userId);
                  const uProfileImage = user && user.profileImage ? user.profileImage : `assets/images/user${this.getRandomInt()}.png`;
                  if (user) {
                    reply = { ...reply, userName: user.name, uProfileImage, parentCommentUsername, timestamp, timestampMiliseconds: miliseconds, comment: decryptedComment }
                  } else {
                    reply = { ...reply, uProfileImage, parentCommentUsername, timestamp, timestampMiliseconds: miliseconds, comment: decryptedComment }
                  }
                } else {
                  reply = { ...reply, uProfileImage: `assets/images/user${this.getRandomInt()}.png`, parentCommentUsername, timestamp, timestampMiliseconds: miliseconds, comment: decryptedComment };
                }
                replies.push(reply);
                }
              }
            }

            let decryptedComment = '';
            if(this.rsaDecryptKey) {
              data.comment  = data.comment.replace(/\n/g, "");
              decryptedComment = this.cryptoService.decryptData(data.comment, this.rsaDecryptKey);
              decryptedComment = this.mapPartiCipantIdInComments(decryptedComment);
              decryptedComment = decryptedComment.replace(/\n/g, "<br/>");
              //console.log(decryptedComment)
            }

            let timestamp = null;
            let miliseconds = 0;
            if (data.timestamp) {
              miliseconds = parseInt((data.timestamp.seconds * 1000).toString()) + parseInt((data.timestamp.nanoseconds / 1000000).toString());
                  
              timestamp = moment(miliseconds).calendar();
              if(timestamp.indexOf('/') !== -1) {
                timestamp =  moment(miliseconds).format("MMM D [at] h:mm a");
              }
            }            

            replies = replies.sort((a, b) => (a.timestampMiliseconds > b.timestampMiliseconds) ? 1 : -1);

            if (this.selectedProjectAllParticipants && this.selectedProjectAllParticipants.length > 0) {
              const user = this.selectedProjectAllParticipants.find(participant => participant.userId == data.userId);
              const uProfileImage = user && user.profileImage ? user.profileImage : `assets/images/user${this.getRandomInt()}.png`;
              if (user) {
                return { ...data, id, userName: user.name, uProfileImage, replies, firebaseReplies: data.replies, timestamp, timestampMiliseconds: miliseconds, comment: decryptedComment }
              } else {
                return { ...data, id, uProfileImage, replies, firebaseReplies: data.replies, timestamp, timestampMiliseconds: miliseconds, comment: decryptedComment }
              }
            }

            return { ...data, id, uProfileImage: `assets/images/user${this.getRandomInt()}.png`, replies, firebaseReplies: data.replies, timestamp, timestampMiliseconds: miliseconds, comment: decryptedComment };
          }
        });
        comments = comments.sort((a, b) => (a.timestampMiliseconds > b.timestampMiliseconds) ? 1 : -1);
        this.comments = comments;

        this.comments.forEach(c => {
          c.replies.forEach(reply => {
            const _parentCommentUsername = this.getParentCommentUsername(reply.parentCommentId, reply.repliedCommentId);
            reply.parentCommentUsername = _parentCommentUsername;
          });
        })
        //console.log(this.comments);
        if(loadedCommentOnTaskClickOrPageLoad && this.selectedTab == 0) {
          clearTimeout(this.getCommentTimer);
          this.scrollContentToBottom();
          this.getCommentTimer = setTimeout(() => {
            loadedCommentOnTaskClickOrPageLoad = false;
            //console.log('................setReadStatus............')
            this.setReadStatus();
          }, 5000);
        }
        
      })
    }

  }

  getTodos() {
    if (this.selectedTask) {  
      if (this.toDosSubs) {
        this.toDosSubs.unsubscribe();
      }
      this.toDosSubs = this.ngFirestore.collection('projectsTasks').doc(this.selectedTask.id).collection('todo').snapshotChanges().subscribe((commentsData) => {
        this.toDos = [];
        let toDos = commentsData.map(toDoData => {
          if (toDoData.payload.doc) {
            const todo = toDoData.payload.doc.data() as any;

            let miliseconds = 0;
            if (todo.timestamp) {
              miliseconds = parseInt((todo.timestamp.seconds * 1000).toString()) + parseInt((todo.timestamp.nanoseconds / 1000000).toString());
            }

            todo.title = todo.title.replace(/\n/g, "<br />");

            return {...todo, timestampMiliseconds: miliseconds}
          }
          return {}
        });

        toDos = toDos.sort((a, b) => (a.timestampMiliseconds > b.timestampMiliseconds) ? 1 : -1);
        this.toDos = toDos;
      });
    }
  }

  getEvents() {
    if (this.selectedTask) {  
      if (this.eventsSubs) {
        this.eventsSubs.unsubscribe();
      }
      this.eventsSubs = this.ngFirestore.collection('projectsTasks').doc(this.selectedTask.id).collection('timeline').snapshotChanges().subscribe((commentsData) => {
        this.events = [];
        let events = commentsData.map(eventData => {
          if (eventData.payload.doc) {
            const event = eventData.payload.doc.data() as any;

            let miliseconds = 0;
            let timestamp = null;
            if (event.timestamp) {
              miliseconds = parseInt((event.timestamp.seconds * 1000).toString()) + parseInt((event.timestamp.nanoseconds / 1000000).toString());

              timestamp = moment(miliseconds).calendar();
              if(timestamp.indexOf('/') !== -1) {
                timestamp =  moment(miliseconds).format("MMM D [at] h:mm a");
              }
            }

            return {...event, timestampMiliseconds: miliseconds, timestamp}
          }
          return {}
        });

        events = events.sort((a, b) => (a.timestampMiliseconds > b.timestampMiliseconds) ? 1 : -1);
        this.mapParticipantNamesAndCreateMessageStr(events);
        //this.events = events;
      });
    }
  }

  async mapParticipantNamesAndCreateMessageStr(events) {
    const mappedEvents = [];
    for(let event of events) {
      const user: any = await this.getParticipantById(event.userId);
      let messageHTML = `<span>${user.name}</span>`;
      if(event.timelineIdentifier == TIMELINE_IDENTIFIER.TASK_CREATE) {
        messageHTML += ` created this task`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TASK_RENAME) { // Test
        const name = event.title.split(',');
        messageHTML += ` renamed the task <span>${name[0]}</span> to <span>${name[1]}</span>`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TASK_DESC_CHANGE) {
        const name = event.title.split(',');
        messageHTML += ` changed the task description <span>${name[0]}</span> to <span>${name[1]}</span>`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TASK_STARTED) {
        messageHTML += ` Started this task`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TASK_COMPLETE) {
        messageHTML += ` marked this task complete`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TASK_IN_COMPLETE) {
        messageHTML += ` marked this task incomplete`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TASK_REQUEST_UPDATE) {
        messageHTML += ` requests updates for this task`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TASK_MEMBER_ASSIGN) { //Test
        const userIds = event.title.split(',');
        messageHTML += ` assigned`;
        for(let userId of userIds) {
          const user: any = await this.getParticipantById(userId);
          messageHTML += ` <span>${user.name}</span>,`;
        };
        messageHTML = messageHTML.substring(0, messageHTML.length-1);
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TASK_MEMBER_UNASSIGN) {
        const userIds = event.title.split(',');
        messageHTML += ` unassigned`;
        for(let userId of userIds) {
          const user: any = await this.getParticipantById(userId);
          messageHTML += ` <span>${user.name}</span>,`;
        };
        messageHTML = messageHTML.substring(0, messageHTML.length-1);
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TASK_OVERDUE) {
        
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TASK_DUE_DATE_CHANGE) {
        const dueDate = event.title.split(',');
        messageHTML += ` changed due date <span>${dueDate[0]}</span> to <span>${dueDate[1]}</span>`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TODO_ADD) {
        messageHTML += ` added <span>${event.title}</span>`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TODO_ADD_MULTIPLE) {
        const titles = event.title.split(',');
        messageHTML += ` assigned`;
        titles.forEach(title => {
          messageHTML += ` <span>${title}</span>,`;
        });
        messageHTML = messageHTML.substring(0, messageHTML.length-1);
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TODO_COMPLETE) {
        messageHTML += ` marked <span>${event.title}</span> complete`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TODO_IN_COMPLETE) {
        messageHTML += ` marked <span>${event.title}</span> incomplete`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TODO_CHANGED) {
        const name = event.title.split(',');
        messageHTML += ` changed <span>${name[0]}</span> to <span>${name[1]}</span>`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.TODO_REMOVE) {
        messageHTML += ` removed <span>${event.title}</span>`;
      } else if (event.timelineIdentifier == TIMELINE_IDENTIFIER.NONE) {
        messageHTML += ` <span>${event.title}</span>`;
      }

      mappedEvents.push({...event, html: messageHTML})
    };
    this.events = mappedEvents;
  }

  setReadStatus() {
    if(this.selectedTab==0 && this.selectedTask) {
      this.ngFirestore.collection('projectsTasks').doc(this.selectedTask.id).collection('comments').ref.get().then((querySnapshot) => {
        const documents = querySnapshot.docs.map(doc => doc.data())
        documents.forEach((comment) => {
          if(!comment.readStatus) {
            let readStatus = {};
            readStatus[this.currentUser.userId] = true;
            const data = {
              readStatus: readStatus
            }
            this.ngFirestore.collection('projectsTasks').doc(this.selectedTask.id).collection('comments').doc(comment.id).set(data, { merge: true })
          } else if(!comment.readStatus[this.currentUser.userId]) {
            let readStatus = comment.readStatus;
            readStatus[this.currentUser.userId] = true;
            const data = {
              readStatus: readStatus
            }
            this.ngFirestore.collection('projectsTasks').doc(this.selectedTask.id).collection('comments').doc(comment.id).set(data, { merge: true })
          }
        })
      });
    }
  }

  scrollContentToBottom() {
    setTimeout(() => {
      //const element = document.getElementById("chat-history");
      this.commentContainers.nativeElement.scrollTop = this.commentContainers.nativeElement.scrollHeight - this.commentContainers.nativeElement.clientHeight;
    }, 0);
  }

  onCommentInputChange(message) {
    //console.log('onCommentInputChange', message);
    this.newComment = message.trim();
  }

  onToDoInputChange(value) {
    //console.log('onCommentInputChange', message);
    this.newToDo = value.trim();
  }

  onKeyUp(event: any) {
    //this.typingTimer = setTimeout(() => {
      //console.log('onKeyUp',event);
      if (this.newComment != '' && event.key == 'Enter' && !event.shiftKey) {
        this.addComment(this.selectedTask.projectId, this.selectedTask.id);
        //console.log('--------- msg sent ------------');
        return;
      }
      if(this.replingTo.repliedCommentId) {
        if(!this.replyInputFiledCleared && event.target.innerText == '' && event.key == 'Backspace') { //key, Backspace
          this.replyInputFiledCleared = true;
        } else if(this.replyInputFiledCleared && event.target.innerText == '' && event.key == 'Backspace') {
          this.clearReplyingToUI();
        } else {
          this.replyInputFiledCleared = false;
        }
      }
    //}, 500);
  }

  onToDoInputKeyUp(event: any) {
    if (this.newToDo != '' && event.key == 'Enter' && !event.shiftKey) {
      this.addTodo();
      return;
    }
  }

  onKeyDown(e) {
    //clearTimeout(this.typingTimer)
    //console.log('onKeyDown', e)
    if(e.keyCode == 13 && !e.shiftKey) {
      return false
    }
  }

  setReplingToUI(parentCommentId, repliedCommentId, userName, firebaseReplies) {
    this.replingTo.parentCommentId = parentCommentId;
    this.replingTo.repliedCommentId = repliedCommentId;
    this.replingTo.userName = userName;
    this.replingTo.firebaseReplies = firebaseReplies ? firebaseReplies : {};
    this.commentInput.nativeElement.focus();
    this.newComment = '';
    this.commentInput.nativeElement.innerText = '';
    this.commentInput.nativeElement.innerHTML = '';
  }

  clearReplyingToUI() {
    this.replingTo.parentCommentId = '';
    this.replingTo.repliedCommentId = '';
    this.replingTo.userName = '';
    this.replingTo.firebaseReplies = {};
    this.replyInputFiledCleared = false;
    this.newComment = '';
    this.commentInput.nativeElement.innerText = '';
    this.commentInput.nativeElement.innerHTML = '';
  }

  async addComment(projectId, taskId) {
    if(this.selectedTask.completed) {
      return;
    }
    const comment = this.newComment.trim()
    this.newComment = "";

    if(comment.length) {
      const encyptedComment = await this.cryptoService.encryptData(comment, this.rsaDecryptKey);
      const commentId = await this.getCommentReference(taskId)
      /*this.ngFirestore.collection('projectsTasks').doc(taskId).collection('comments').doc().get().subscribe((res) => {
        console.clear();
        console.log('commentDoc: ', res.ref.id)
      });*/
      
      const data = {
        comment: encyptedComment,
        userId: this.currentUser.userId,
        taskId: taskId,
        id: commentId,
        projectId: projectId,
        timestamp: new Date(),
        parentCommentId: this.replingTo.parentCommentId,
        repliedCommentId: this.replingTo.repliedCommentId,
        readStatus: {},
        commentType: 1
      }
      if(this.replingTo.repliedCommentId) {
        let firebaseReplies = this.replingTo.firebaseReplies;
        firebaseReplies[commentId] = data;
        const parentComment = {
          replies: firebaseReplies
        }
        this.ngFirestore.collection('projectsTasks').doc(taskId).collection('comments').doc(this.replingTo.parentCommentId).set(parentComment, { merge: true }).then(() => {
          this.clearReplyingToUI();
          this.scrollContentToBottom();
        })
      } else {
        const readStatus = {};
        readStatus[this.currentUser.userId] = true;
        data.readStatus = readStatus;
        this.ngFirestore.collection('projectsTasks').doc(taskId).collection('comments').doc(commentId).set(data).then(() => {
          this.clearReplyingToUI();
          this.scrollContentToBottom();
        })
      }
    }
  }

  async addTodo() {
    if(this.selectedTask.completed) {
      alert("Can't add/edit To Do of completed task!")
      return;
    }
    const userRole = this.checkUserIsAdminOrParticipant(this.currentUser.userId, this.selectedTask);
    if(userRole != 'admin' && userRole != 'participant') {
      alert("Only card's admin or task's participant can add ToDo!")
      return;
    }
    const newToDo = this.newToDo.trim()
    this.newToDo = "";
    if(newToDo.trim() != '') {
      const todoId = await this.getToDoReference(this.selectedTask.id);

      const data = {
          userId: this.currentUser.userId,
          taskId: this.selectedTask.id,
          id: todoId,
          projectId: this.projectId,
          timestamp: new Date(),
          complete: false,
          title: newToDo
        }

      this.ngFirestore.collection('projectsTasks').doc(this.selectedTask.id).collection('todo').doc(todoId).set(data, { merge: true }).then(() => {
        console.log('todo added');
        this.newToDo = '';
        this.toDoInput.nativeElement.innerText = '';
        this.toDoInput.nativeElement.innerHTML = '';
        this.saveTimeline(this.selectedTask.id, 'To-Do', TIMELINE_IDENTIFIER.TODO_ADD, data.title).subscribe(res => {});
      })
    }
    
  }

  updateToDoStatus(toDo) {
    if(this.selectedTask.completed) {
      alert("Can't update status of To Do of completed task!");
      return;
    }
    const userRole = this.checkUserIsAdminOrParticipant(this.currentUser.userId, this.selectedTask);
    if(userRole != 'admin' && userRole != 'participant') {
      alert("Only card's admin or task's participant can update ToDo!")
      return;
    }
    const newStatus = !toDo.complete;
    this.ngFirestore.collection('projectsTasks').doc(toDo.taskId).collection('todo').doc(toDo.id).set({complete: !toDo.complete}, { merge: true }).then(() => {
      console.log('todo updated')
      if(newStatus) {
        this.saveTimeline(this.selectedTask.id, 'To-Do', TIMELINE_IDENTIFIER.TODO_COMPLETE, toDo.title).subscribe(res => {});
      } else {
        this.saveTimeline(this.selectedTask.id, 'To-Do', TIMELINE_IDENTIFIER.TODO_IN_COMPLETE, toDo.title).subscribe(res => {});
      }
    })
  }

  getCommentReference(taskId) {
    return new Promise<string>((resolve, reject) => {
      this.ngFirestore.collection('projectsTasks').doc(taskId).collection('comments').doc().get().subscribe(res => {
        resolve(res.ref.id)
      })
    })
  }

  getToDoReference(taskId) {
    return new Promise<string>((resolve, reject) => {
      this.ngFirestore.collection('projectsTasks').doc(taskId).collection('todo').doc().get().subscribe(res => {
        resolve(res.ref.id)
      })
    })
  }

  getParentCommentUsername(parentCommentId, repliedCommentId) {
    if (parentCommentId == repliedCommentId) {
      const comment = this.comments.find(comment => comment.id == parentCommentId);
      const user = this.selectedProjectAllParticipants.find(participant => participant.userId == comment.userId);
      return user ? user.name : '...';
    } else {
      const comment = this.comments.find(comment => comment.id == parentCommentId);
      const reply = comment.replies.find(comment => comment.id == repliedCommentId);
      const user = this.selectedProjectAllParticipants.find(participant => participant.userId == reply.userId);
      return user ? user.name : '...';
    }
  }

  openTaskOperationDropDown(dropDown) {
    //event.stopPropagation();
    dropDown.show();
  }

  onOperationDropDownOpenChange(value) {
    if(value) {
      setTimeout(() => {
        const popupEleRef = this.operationDropdownPopup.nativeElement; //To get popup height
        const popupContainer = popupEleRef.parentElement.parentElement; // To Set transform
        const leftPanelEleRef = popupContainer.parentElement; // To get header hight
        const translateXY = this.getTranslateXY(popupContainer)
        if(popupEleRef.offsetHeight+5+translateXY.translateY > leftPanelEleRef.offsetHeight) {
          popupEleRef.style.top = `${leftPanelEleRef.offsetHeight - (popupEleRef.offsetHeight+10+translateXY.translateY)}px`;
        }
      }, 0)
    }
    
    
  }

  getTranslateXY(element) {
    const style = window.getComputedStyle(element)
    const matrix = new DOMMatrixReadOnly(style.transform)
    return {
        translateX: matrix.m41,
        translateY: matrix.m42
    }
  }

  toogleTaskAction(task, action) {
    //if(task.completed && action == 'callToAction') {
      //alert("Operation not allowed on completed task!")
      //return;
    //}
    if(action != 'callToAction') {
      const allowed = this.isAllowedToUpdateStatus(this.currentUser.userId, task);
      if(!allowed) {
        alert("You are not allowed to update task status!");
        return;
      }
    }
    
    let taskObj: any = {} 
    taskObj[action] = !task[action];
    task[action] = taskObj[action];
    if(action != 'callToAction') {
      task['isStarted'] = true;
      taskObj['isStarted'] = true;
      if(taskObj[action]) {
        taskObj['callToAction'] = false;
        task['callToAction'] = false;
      }
    }
    this.ngFirestore.collection('projectsTasks').doc(task.id).set(taskObj, { merge: true })
    if(action == 'callToAction') {
      if(task[action]) {
        this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.TASKREQUESTUPDATE, ACTIVITY_IDENTIFIER.TASK_REQUEST_UPDATE, this.currentUser.userId, ACTION_TITLE_MAPPER.task_requpdate.replace('$projectName', task.name), 8, this.projectId).subscribe(res => {})
        this.saveTimeline(task.id, 'Task Action', TIMELINE_IDENTIFIER.TASK_REQUEST_UPDATE, 'requests updates').subscribe(res => {});
      }
    } else {
      if(taskObj.completed) {
        this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.TASKCOMPLETED, ACTIVITY_IDENTIFIER.TASK_COMPLETED, this.currentUser.userId, ACTION_TITLE_MAPPER.task_completed.replace('$projectName', task.name), 8, this.projectId).subscribe(res => {})
        this.saveTimeline(task.id, 'Task Action', TIMELINE_IDENTIFIER.TASK_COMPLETE, 'complete').subscribe(res => {});
      } else {
        this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.TASKINCOMPLETE, ACTIVITY_IDENTIFIER.TASK_INCOMPLETED, this.currentUser.userId, ACTION_TITLE_MAPPER.task_incomplete.replace('$projectName', task.name), 8, this.projectId).subscribe(res => {})
        this.saveTimeline(task.id, 'Task Action', TIMELINE_IDENTIFIER.TASK_IN_COMPLETE, `incomplete`).subscribe(res => {});
      }
    }
    
  }

  updateTaskStatus(task) {
    const allowed = this.isAllowedToUpdateStatus(this.currentUser.userId, task);
    if(!allowed) {
      alert("You are not allowed to update task status!");
      return;
    }
    let taskObj = {}
    if (!task.isStarted) {
      taskObj['isStarted'] = true;
      this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.TASKSTARTED, ACTIVITY_IDENTIFIER.TASK_STARTED, this.currentUser.userId, ACTION_TITLE_MAPPER.task_started.replace('$projectName', task.name), 8, this.projectId).subscribe(res => {})
      this.saveTimeline(task.id, 'Task Action', TIMELINE_IDENTIFIER.TASK_STARTED, 'started').subscribe(res => {});
    } else {
      taskObj['completed'] = !task.completed;
      if(taskObj['completed']) {
        task['callToAction'] = false;
        this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.TASKCOMPLETED, ACTIVITY_IDENTIFIER.TASK_COMPLETED, this.currentUser.userId, ACTION_TITLE_MAPPER.task_completed.replace('$projectName', task.name), 8, this.projectId).subscribe(res => {})
        this.saveTimeline(task.id, 'Task Action', TIMELINE_IDENTIFIER.TASK_COMPLETE, 'complete').subscribe(res => {});
      } else {
        this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.TASKINCOMPLETE, ACTIVITY_IDENTIFIER.TASK_INCOMPLETED, this.currentUser.userId, ACTION_TITLE_MAPPER.task_incomplete.replace('$projectName', task.name), 8, this.projectId).subscribe(res => {})
        this.saveTimeline(task.id, 'Task Action', TIMELINE_IDENTIFIER.TASK_IN_COMPLETE, 'incomplete').subscribe(res => {});
      }
    }
    this.ngFirestore.collection('projectsTasks').doc(task.id).set(taskObj, { merge: true })
  }

  deleteTask(task) {
    const allowed = this.isAdminOrCreator(this.currentUser.userId, task);
    if(!allowed) {
      alert("Only card's admin and task creator is allowed to delete task!");
      return;
    }
    this.ngFirestore.collection('projectsTasks').doc(task.id).delete().then(() => {
      //this.store.dispatch(new DeleteTask(task.id));
      console.log('task deleted..')
      this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.TASKDELETED, ACTIVITY_IDENTIFIER.TASK_DELETED, this.currentUser.userId, ACTION_TITLE_MAPPER.task_deleted.replace('$projectName', task.name), 8, this.projectId).subscribe(res => {})
    })
  }

  startCreateTask() {
    this.selectedTab = -1;
    this.searchedUsersArr = [];
    this.selectedProjectAllParticipants.forEach(userData => {
      userData['involved'] = false;
      this.searchedUsersArr.push({...userData, involved: false});
    });

    this.involvedPersonsKey = new Map();
    const minDate = new Date();
    this.minDate = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    this.initForm();
    this.formSubmitted = false;
  }

  startEditTask(task) {
    const allowed = this.isAdminOrCreator(this.currentUser.userId, task);
    if(!allowed) {
      alert("Only card's admin and task creator is allowed to edit task!");
      return;
    }
    this.selectedTab = -1;
    this.searchedUsersArr = [];

    this.involvedPersonsKey = new Map();

    this.selectedProjectAllParticipants.forEach(user => {
      let userInvoled = false;
      task.participants.forEach(participant => {
        if (user.userId == participant.id) {
          userInvoled = true;
        }
      });
      if(userInvoled) {
        this.involvedPersonsKey.set(`${user.userId}`, {...user, id: user.userId});
      }
      this.searchedUsersArr.push({...user, id: user.userId, involved: userInvoled });
    });

    //console.log(this.searchedUsersArr);
    if(task.dueDate) {
      const _tempMinDate = new Date(task.dueDate);
      const tempMinDate = new Date(_tempMinDate.getFullYear(), _tempMinDate.getMonth(), _tempMinDate.getDate());

      const _currentDate = new Date();
      const currentDate = new Date(_currentDate.getFullYear(), _currentDate.getMonth(), _currentDate.getDate());

      if(tempMinDate < currentDate) {
        this.minDate = tempMinDate;
      } else {
        this.minDate = currentDate;
      }
    } else {
      this.minDate = new Date();
    }

    this.taskForm.patchValue({
      id: task.id,
      name: task.name,
      dueDate_DB: task.dueDate ? new Date(task.dueDate) : null,
      description: task.description ? task.description : '',
      callToAction: task.callToAction ? task.callToAction : false,
      completed: task.completed ? task.completed : false,
      createdBy: task.createdBy,
      isStarted: task.isStarted ? task.isStarted : false,
      projectId: task.projectId,
      //participants_DB: 'sda',
      readStatus: task.readStatus,
      timestamp_DB: task.timestamp ?  new Date(task.timestamp) : null
    });
    this.formSubmitted = false;
    this.taskObj_beforeUpdate = task;
  }

  removeParticipant(userId) {
    this.involvedPersonsKey.delete(userId);

    const userIndex = this.searchedUsersArr.findIndex(s_user => s_user.userId == userId);
    if(userIndex != -1) {
      this.searchedUsersArr[userIndex].involved = false;
    }
  }

  onKeyUp_search(event: any) {
    clearTimeout(this.typingTimer)
    this.typingTimer = setTimeout(() => {
      this.doneTyping(event.target.value)
    }, 500);
  }

  onKeyDown_search() {
    clearTimeout(this.typingTimer)
  }

  doneTyping (search) {
    this.searchedUsersArr = [];
    if (search.length > 0) {
      this.selectedProjectAllParticipants.forEach(userData => {
        if (this.involvedPersonsKey.get(`${userData.userId}`)) {
          userData['involved'] = true
        } else {
          userData['involved'] = false
        }
        if(userData.keywords.indexOf(search) != -1) {
          this.searchedUsersArr.push(userData);
        }
      });

      /*this.searchUserCallable({searchText: search}).subscribe(res => {
        res.forEach(user => {
          const userData = JSON.parse(user)
          if (this.involvedPersonsKey.get(`${userData.userId}`)) {
            userData['involved'] = true
          } else {
            userData['involved'] = false
          }
          const userIndex = this.searchedUsersArr.findIndex(s_user => s_user.userId == userData.userId);
          if(userIndex == -1) {
            this.searchedUsersArr.push(userData)
          }
        });
      })*/
    } else {
      this.selectedProjectAllParticipants.forEach(userData => {
        if (this.involvedPersonsKey.get(`${userData.userId}`)) {
          userData['involved'] = true
        } else {
          userData['involved'] = false
        }
        this.searchedUsersArr.push(userData);
      });
      this.searchedUsersArr = this.selectedProjectAllParticipants;
    }
  }

  addOrRemoveAssignee(user) {
    //debugger
    if (!user.involved) {
      this.involvedPersonsKey.set(`${user.userId}`, { ...user, id: user.userId, addedBy: this.currentUser.userId });
    } else {
      this.involvedPersonsKey.delete(`${user.userId}`);
    }
    user.involved = !user.involved;
  }

  mapPartiCipantIdInComments(comment) {
    this.selectedProjectAllParticipants.forEach(p => {
      const id = p.userId;
      const re = new RegExp("@" + id, "g");
      comment.replace(re, p.name);
      let match;
      while ((match = re.exec(comment)) != null) {
        console.log("match found at " + match.index);
        comment = comment.replace('@'+id, `<span>@${p.name}</span>`);
      }
    })
    
    return comment
  }

  checkUserIsAdminOrParticipant(userId, task) {
    const card = this.card;
    if(card.createdBy == userId) {
      return 'admin';
    }
    if(task) {
      let participant_found = false;
      task.participants.forEach(t_participant => {
        if(t_participant['id'] == userId) {
          participant_found = true;
        }
      });
      if(participant_found) {
        return 'participant';
      }
    }
    return 'not_found';
  }

  isAdminOrCreator(userId, task) {
    if(this.card.createdBy == userId || task.createdBy == userId) {
      return true;
    }
    return false;
  }

  isAllowedToUpdateStatus(userId, task) {
    if(task.participants.length == 0) {
      return true;
    } else {
      if(this.card.createdBy == userId || task.createdBy == userId) {
        return true;
      }
      let participant_found = false;
      task.participants.forEach(t_participant => {
        if(t_participant['id'] == userId) {
          participant_found = true;
        }
      });
      if(participant_found) {
        return true;
      }
    }
    return false;
  }

  async addOrUpdateTask() {
    this.firebaseProjectService.getAllProjectsSub.unsubscribe();
    this.firebaseTaskService.getTasksByProjectIdSubs.forEach((subscription) => {
        subscription.unsubscribe();
    });
    this.formSubmitted = true;

    const formValues = this.taskForm.value;
    const taskId = formValues.id ? this.taskForm.value.id : await this.getTaskReference();
    if(!formValues.readStatus) {
      formValues.readStatus = {};
    }
    const readStatus = {...formValues.readStatus};
    readStatus[this.currentUser.userId] = true;

    const participants = {};

    this.involvedPersonsKey.forEach((value, key) => {
      const involvedDataObject = {};
      involvedDataObject['id'] = value['id'];
      involvedDataObject['addedBy'] = value['addedBy'] ? value['addedBy'] : this.currentUser.userId;
      involvedDataObject['admin'] = this.checkUserIsAdminOrParticipant(value['id'], null) == 'admin' ? true : false;
      involvedDataObject['stared'] = value['stared'] ? value['stared'] : false;
      involvedDataObject['timestamp'] = value['timestamp'] ? value['timestamp'] : new Date();
      involvedDataObject['taskId'] = taskId;
      involvedDataObject['projectId'] = this.projectId;
      participants[`${key}`] = involvedDataObject;
    });
    const data: any = {
      id: taskId,
      name: formValues.name,
      dueDate: formValues.dueDate_DB ? formValues.dueDate_DB : null,
      description: formValues.description.trim(),
      callToAction: formValues.callToAction,
      completed: formValues.completed,
      createdBy: formValues.id ? formValues.createdBy : this.currentUser.userId,
      isStarted: formValues.isStarted,
      projectId: this.projectId,
      participants: participants,
      readStatus: readStatus,
      timestamp: formValues.id ? formValues.timestamp_DB : new Date()
    }

    if (data.dueDate) {
      const dueDate = new Date(data.dueDate);
      data.dueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    }

    const taskDocRef = this.ngFirestore.collection('projectsTasks').doc(taskId);
    if(formValues.id) {
      taskDocRef.update(data).then(() => {
        //this.setProjectParticipants();
        if(this.selectedTask.id === formValues.id) {
          this.selectedTask.description = formValues.description.trim();
        }
        if(data.name !== this.taskObj_beforeUpdate.name) {
          this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.TASKRENAMED, ACTIVITY_IDENTIFIER.TASK_RENAMED, this.currentUser.userId, ACTION_TITLE_MAPPER.task_renamed.replace('$name', this.taskObj_beforeUpdate.name).replace('$projectName', data.name), 8, this.projectId).subscribe(res => {})
          this.saveTimeline(data.id, 'Task Action', TIMELINE_IDENTIFIER.TASK_RENAME, `${this.taskObj_beforeUpdate.name},${data.name}`).subscribe(res => {});
        }
        if(data.description !== this.taskObj_beforeUpdate.description) {
          this.saveTimeline(data.id, 'Task Action', TIMELINE_IDENTIFIER.TASK_DESC_CHANGE, `${this.taskObj_beforeUpdate.description},${data.description}`).subscribe(res => {});
        }
        this.taskObj_beforeUpdate.participants.forEach(participant => {
          const user = data.participants[participant.id];
          if(!user) {
            this.saveTimeline(data.id, 'Task Action', TIMELINE_IDENTIFIER.TASK_MEMBER_UNASSIGN, participant.id).subscribe(res => {});
          }
        });
        Object.keys(data.participants).forEach((pId) => {
          const user = this.taskObj_beforeUpdate.participants.find(p => p.id == pId);
          if(!user) {
            this.saveTimeline(data.id, 'Task Action', TIMELINE_IDENTIFIER.TASK_MEMBER_ASSIGN, pId).subscribe(res => {});
          }
        });
        const tempDueDate = this.taskObj_beforeUpdate.dueDate ? new Date(this.taskObj_beforeUpdate.dueDate) : null;
        const oldDueDate = tempDueDate ? new Date(tempDueDate.getFullYear(), tempDueDate.getMonth(), tempDueDate.getDate()) : null;
        if(data.dueDate != oldDueDate) {
          const oldDueDateStr = oldDueDate ? moment(oldDueDate).format("D MMM") : '--';
          const newDueDateStr = moment(data.dueDate).format("D MMM");
          this.saveTimeline(data.id, 'Due Date', TIMELINE_IDENTIFIER.TASK_DUE_DATE_CHANGE, `${oldDueDateStr},${newDueDateStr}`).subscribe(res => {});
        }
        this.formSubmitted = false;
        this.initForm();
        this.selectedTab = 0;
        this.firebaseProjectService.loadAllUserData();
      }, err => {
        console.log(err);
        this.formSubmitted = false;
        this.firebaseProjectService.loadAllUserData();
      });
    } else {
      taskDocRef.set(data, { merge: true }).then(() => {
        //this.setProjectParticipants();
        this.formSubmitted = false;
        this.initForm();
        this.selectedTab = 0;
        this.firebaseProjectService.loadAllUserData();
        this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.TASKCRETED, ACTIVITY_IDENTIFIER.TASK_CREATED, this.currentUser.userId, ACTION_TITLE_MAPPER.task_created.replace('$projectName', data.name), 8, this.projectId).subscribe(res => {});
        this.saveTimeline(data.id, 'Task Action', TIMELINE_IDENTIFIER.TASK_CREATE, 'created').subscribe(res => {});
        
      }, err => {
        console.log(err);
        this.formSubmitted = false;
        this.firebaseProjectService.loadAllUserData();
      });
    }
  }


  /*setProjectParticipants() {
    const card = this.store.selectSnapshot(CardsState.getProjectById(this.projectId));
      let participantIdsToInsert = [];
      this.involvedPersonsKey.forEach((t_participant) => {
        let participant_found = false;
        card.participants.forEach(c_participant => {
          if(t_participant['id'] == c_participant['id']) {
            participant_found = true;
          }
        });

        if(!participant_found) {
          participantIdsToInsert.push(t_participant['id']);
        }
      });

      console.log(participantIdsToInsert);
      if(participantIdsToInsert.length != 0) {
        const projectParticipants = [];
        this.firebaseUserService.getOnlyAllParticipantsbyIds(participantIdsToInsert).subscribe((participantsData) => {
          const documents = participantsData.docs.map(doc => doc.data())
          documents.forEach((participant) => {
            projectParticipants.push(participant);
          });
          console.log(projectParticipants);

          const newProjectParticipants = this.generateProjectParticipants(projectParticipants);
          card.participants.forEach((item) => {
            newProjectParticipants[item.id] = item;
          });
          const payload = {
            participants: newProjectParticipants
          }

          this.firebaseProjectService.addProject(payload, this.projectId)
          .subscribe(res => {
            this.formSubmitted = true;
            this.initForm();
            this.selectedTab = 0;
            this.firebaseProjectService.loadAllUserData();
          }, error => {
            console.log('Error: Dashboarded => newcard', error);
            this.formSubmitted = true;
            this.firebaseProjectService.loadAllUserData();
          })
        })
      } else {
        this.formSubmitted = true;
        this.initForm();
        this.selectedTab = 0;
        this.firebaseProjectService.loadAllUserData();
      }
  }*/

  saveTimeline(taskId, type, timelineIdentifier, title?) {
    const timeline = {};
    timeline['projectId'] = this.projectId;
    timeline['taskId'] = taskId;
    timeline['timelineIdentifier'] = timelineIdentifier;
    timeline['timestamp'] = new Date();
    timeline['title'] = title;
    timeline['type'] = type;
    timeline['userId'] = this.currentUser.userId;

    const timelineRef = this.ngFirestore.collection("projectsTasks").doc(taskId).collection('timeline').doc()
    timeline['id'] = timelineRef.ref.id;

    return this.afAuth.user
      .pipe(
        switchMap(fbUser => {
          if (fbUser) {
            return timelineRef.set(timeline)
          } else {
            throw new Error('Firebase Authentication User not found');
          }
        })
      );
    // this.saveLogs(projectRef, activity, activityRef)
  }

  getTaskReference() {
    return new Promise<string>((resolve, reject) => {
      this.ngFirestore.collection('projectsTasks').doc().get().subscribe(res => {
        resolve(res.ref.id)
      })
    })
  }

  generateProjectParticipants(users) {
    const participantsObject = {}
    users.forEach((value, key) => {
      const involvedDataObject = {}
      involvedDataObject['secret'] = this.generateSecretForParticipants(this.projectId, value['publicKey'])
      involvedDataObject['addedBy'] = this.currentUser.userId
      involvedDataObject['id'] = key
      involvedDataObject['admin'] = key === this.currentUser.userId ? true : false
      involvedDataObject['groupId'] = '1'
      involvedDataObject['stared'] = false
      involvedDataObject['status'] = key === this.currentUser.userId ? 2 : 1
      involvedDataObject['timestamp'] = new Date();
      participantsObject[`${key}`] = involvedDataObject
    })
    return participantsObject;
  }

  generateSecretForParticipants (projectId, userPublicKey) {
    const secretKey = this.cryptoService.generateKey(projectId)
    const secret = this.cryptoService.rsaEncryption(secretKey, userPublicKey)
    return secret;
  }

  setMaxWidth() {
    setTimeout(() => {
      if(this.commentInput) {
        let reply_width = 0
        if(this.replingTo.repliedCommentId) {
          reply_width = this.commentInput.nativeElement.parentElement.childNodes[1].offsetWidth
          console.log(reply_width)
        }
        console.log(this.commentInput.nativeElement.parentElement.offsetWidth-20);
        this.commentInput.nativeElement.style.maxWidth = (this.commentInput.nativeElement.parentElement.offsetWidth - 20 - 20 - reply_width - 3 - 5) + 'px';
      }
    }, 0);
  }

  filterationBasedOnStatClick() {
    this.filterOptions = {
      updateRequest: [],
      status: [],
      participants: []
    };
    if(this.filterString.includes("completed")) {
      this.filterOptions.status = ["completed"]
    } else if(this.filterString.includes("pending")) {
      this.filterOptions.status = ["pending", "in-progress", "overdue"]
    }
    if(this.filterString.includes("my")) {
      const users = this.selectedProjectAllParticipants.map((participant) => {
        console.log(participant)
        if(participant.userId === this.currentUser.userId) {
          participant.selected = true
        }
        return participant
      });
      this.filterOptions.participants = [...users]
    } else {
      const mappedParticipants = this.selectedProjectAllParticipants.map((participant) => {
        return {...participant, selected: false};
      });
      this.filterOptions.participants = [...mappedParticipants]
    }
    this.filterTasks();
    this.filterApplied = true;
    this.filterString = ''
  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
    if (this.loadDataSubs) {
      this.loadDataSubs.unsubscribe();
    }
    if (this.getParticipantSubs) {
      this.getParticipantSubs.unsubscribe();
    }
    if (this.commentSubs) {
      this.commentSubs.unsubscribe();
    }
    if (this.toDosSubs) {
      this.toDosSubs.unsubscribe();
    }
    if (this.eventsSubs) {
      this.eventsSubs.unsubscribe();
    }
  }
}
