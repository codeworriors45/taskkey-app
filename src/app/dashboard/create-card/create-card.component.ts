import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AngularFireStorage } from "@angular/fire/storage";
import { AngularFireFunctions } from "@angular/fire/functions"
import { FormGroup, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { takeUntil, finalize } from 'rxjs/operators';
import { Subject, Observable, Subscription} from 'rxjs';
import { FirebaseProjectService } from '../../services/firebaseProject.service';
import { FirebaseUserService } from '../../services/firebaseUser.service'
import { CryptoService } from '../../services/crypto.service';
import { User } from '../../interfaces/user.interface';
import { AngularFirestore } from '@angular/fire/firestore';
import { Store } from '@ngxs/store';
import { CardsState } from '../../stateManagement/cards/cards.state';
import { FirebaseTemplatesService } from '../../services/firebaseTemplates.service';
import { ActivitylogsService } from 'src/app/services/activitylogs.service';
import { ACTION_MAPPER, ACTION_TITLE_MAPPER } from '../../interfaces/activity.action'
import { ACTIVITY_IDENTIFIER } from '../../interfaces/activity.identifiers';
import { AppEventService } from '../../services/event.service';

@Component({
  selector: 'app-create-card',
  templateUrl: './create-card.component.html',
  styleUrls: ['./create-card.component.scss']
})
export class CreateCardComponent implements OnInit, AfterViewInit, OnDestroy{
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  public screenSwitchArray: Array<boolean> = Array(2).fill(false)
  public defaultImage: string = "assets/images/card_image.svg"
  public createCardForm: FormGroup;
  public serchUserForm: FormGroup;
  public cardImageUrl = ''
  public downloadURL: Observable<string>
  public createCardSubmitted = false;
  public userDetails: any
  public projectId: any
  public showCreateCard: Boolean = true
  public searchUserCallable: any
  public involvedPersonsKey: Map<String, Object> = new Map()
  public typingTimer: any
  public usersArray: Array<any> = []
  public initalStateInvite: String = 'Invite';
  public searchText: any
  public userSearchLoading = false
  public projectPicLoader = false
  public projectTemplates: any = []
  public sortBy = ''
  public sortOrder = 1
  public templateDetails = false
  public selectedTemplate = null
  public appliedTemplate = null
  @ViewChild('scrollWrapper') scrollWrapper: ElementRef;
  public selectedCard: any
  public getParticipantsSub: any
  public createCradLabel = 'Create'
  public assigningRole = null
  public role = 'Member'
  public adminRoleLabel = 'Make Admin'
  public getCardSub: Subscription;
  public selectedTab = 0;
  public oldParticipants: any[] = [];


  constructor(
    public bsModalRef: BsModalRef,
    public router: Router,
    private modalService: BsModalService,
    private createCardFormBuilder: FormBuilder,
    private storage: AngularFireStorage,
    private firebaseProjectService: FirebaseProjectService,
    private cryptoService: CryptoService,
    private firebaseUserService: FirebaseUserService,
    private cloudFunctions: AngularFireFunctions,
    private firebaseTemplatesService: FirebaseTemplatesService,
    private ngFirestore: AngularFirestore,
    private store: Store,
    private ngFireFunctions: AngularFireFunctions,
    private activitylogsService: ActivitylogsService,
    private appEventService: AppEventService
  ) {
      this.searchUserCallable = this.cloudFunctions.httpsCallable('searchUser');
      this.initForms();
      if(this.selectedCard) {
        this.getCardSub = this.store.select(CardsState.getProjectById(this.selectedCard.id)).subscribe(async (card) => {
          this.selectedCard = card
          this.cardImageUrl = this.selectedCard.image
          this.createCardForm.patchValue({
            cardName: this.selectedCard.name,
            description: this.selectedCard.description,
          })
        })
      }
  }

  ngOnInit() {
    //console.clear();
    //console.log(this.selectedCard);
    this.screenSwitchArray = [true, false];
    
    this.firebaseUserService.getCurrentUser().pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(async (userData) => {
      const user = userData;
      this.userDetails = user;
      
      if(!this.selectedCard) {
        this.involvedPersonsKey.set(`${this.userDetails.userId}`, {...this.userDetails, admin: true});
        this.userDetails.admin = true;
      } else {
        for(const user of this.selectedCard.participants) {
          const sUser: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(user.id);
          let userData: any = {...sUser};
          
          userData['newInvolved'] = false;
          userData['involved'] = true;
          userData['admin'] = user.admin ? user.admin : false;
          
          if(userData.userId == this.userDetails.userId) {
            this.userDetails.admin = userData.admin ? userData.admin : false;
          }

          if(this.usersArray.length > 0) { // means popup is opened and UI => user is searching for user
            userData['isAllowed'] = this.canEditParticipantRole(userData);

            const index = this.usersArray.findIndex(user => user.userId == userData.userId)
            if(index != -1) {
              this.usersArray[index] = userData;
            } else {
              this.usersArray.push(userData)
            }
          }
          
          this.involvedPersonsKey.set(`${userData.userId}`, userData);
        }
        
        // remove user from UI if not exist (realtime changes by another user)
        const userIdsToRemove = [];
        this.involvedPersonsKey.forEach((op: any) => {
          const user_found = this.selectedCard.participants.find(p => p.id == op.userId)
          if(!user_found) {
            userIdsToRemove.push(op.userId);
          }
        });
        userIdsToRemove.forEach(userId => {
          this.involvedPersonsKey.delete(`${userId}`);
          if(this.usersArray.length > 0) {
            const indexToRemove = this.usersArray.findIndex(user => user.userId == userId)
            if(indexToRemove != -1) {
              this.usersArray.splice(indexToRemove, 1);
            }
          }
        })
        
        this.cardImageUrl = this.selectedCard.image
        this.createCardForm.patchValue({
          cardName: this.selectedCard.name,
          description: this.selectedCard.description,
        })
        this.createCradLabel = 'Edit';
      }
      this.getRecentParticipants();
    })
  }

  ngAfterViewInit() {
    this.modalService.onHide.pipe(takeUntil(this.subscriptionDestroyed$))
    .subscribe(() => {
      const currentUrl = this.router.url;
      const indexOfQuerySaperater = currentUrl.indexOf('?');
      if(indexOfQuerySaperater !== -1) {
        this.router.navigateByUrl(currentUrl.slice(0, indexOfQuerySaperater))
      }
      this.appEventService.closeCreateCardEmitter.next()
    });
    this.firebaseTemplatesService.getAndListenAllTemplates(10).pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(data => {
      this.projectTemplates = data
    })
  }

  initForms() {
    this.createCardForm = this.createCardFormBuilder.group({
      cardName: ['', [Validators.required]],
      description: ['']
    })
    this.serchUserForm = this.createCardFormBuilder.group({
      searchStr1: ['', [this.validateSearchStr1]],
      searchStr2: ['', [this.validateSearchStr2]],
      searchStr3: ['']
    })
  }

  public validateSearchStr1(control: AbstractControl): { [key: string]: any } {
    let reg = /^(\+)[1-9][0-9]*$/;
    if(control.value) {
      let phoneStr = control.value.toString();
      if (reg.test(phoneStr) == false) {
        return { 'invalidStr': true };
      }
    }
    return null;
  }

  public validateSearchStr2(control: AbstractControl): { [key: string]: any } {
    if(control.value) {
      let reg = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z0-9])+(([a-zA-Z\-0-9]+\.)|(\.))+[a-zA-Z]{2,}))$/;
      if (reg.test(control.value) == false) {
        return { 'invalidStr': true };
      }
    }
    return null;
  }

  getRecentParticipants() {
    const subscription = this.store
      .select((x) => x.home)
      .subscribe(async  (home) => {
        if (home.loadedInitialUserData) {
          try {
            if(subscription) {
              subscription.unsubscribe();
            }
          } catch (e) {
            console.log(e)
          }

          const oldParticipants = [];
          for(let p of this.firebaseProjectService.allParticipants) {
            let user = {...p};
            user['isAllowed'] = this.canEditParticipantRole(user);
            oldParticipants.push(user);
          }
          this.oldParticipants = oldParticipants;
          if(this.selectedTab == 2) {
            this.oldParticipants.forEach(p => {
              const oldUser = this.involvedPersonsKey.get(`${p.userId}`);
              if(oldUser) {
                p['involved'] = true;
                p['admin'] = oldUser['admin'];
                p['newInvolved'] = oldUser['newInvolved'];
              } else {
                p['involved'] = false;
                p['admin'] = false;
                p['newInvolved'] = undefined;
              }
            });
            this.usersArray = [...this.oldParticipants];
          }
          //console.log(oldParticipants)
        }
      }, err => {
        console.log(err)
        try {
          if(subscription) {
            subscription.unsubscribe();
          }
        } catch (e) {
          console.log(e)
        }
      });
  }

  async populateSettingsScreen(event) {
    switch(event.target.id) {
      case "newcard": 
        this.screenSwitchArray = Array(2).fill(false)
        this.screenSwitchArray[0] = true
        break;
      case "choosetemplate": 
        this.screenSwitchArray = Array(2).fill(false)
        this.screenSwitchArray[1] = true
        this.templateDetails = false
        this.selectedTemplate = null
        break;
    }
  }

  closePopupAndRemoveParamFromURL() {
    this.bsModalRef.hide();
  }

  async saveProject() {
    this.createCardSubmitted = true
    const payload = {}
    if (this.createCardForm.valid) {
      let projectId
      let secretKey = ''
      if (this.selectedCard) {
        projectId = this.selectedCard.id
        const user = this.selectedCard.participants.find(participant => {
          if (participant.id === this.userDetails['userId']) {
            return participant
          }
        })
        secretKey = await this.getSecretKey(user)
        payload['createdBy'] = this.selectedCard.createdBy
      } else {
        projectId = await this.getProjectReference()
        secretKey = this.cryptoService.generateKey(projectId)
        payload['createdBy'] = this.userDetails.userId
      }
      const formValues = this.createCardForm.value;
      payload['image'] = this.cardImageUrl || ''; 
      payload['id'] = projectId
      
      payload['name'] = formValues.cardName
      payload['description'] = formValues.description
      payload['completed'] = false
      payload['participants'] = this.generateParticipants(secretKey, projectId)
      payload['timestamp'] = new Date()
      // console.log(payload)
      // return 
      if (this.selectedCard) {
        //console.log(payload)
        this.firebaseProjectService.updateProjectNotMerge(payload, projectId)
          .subscribe(res => {
            console.log('Project updaed')
          })
        this.createCardSubmitted = false
        this.bsModalRef.hide();
      } else {
        this.firebaseProjectService.addProject(payload, projectId)
          .subscribe(res => {
            console.log('Project added successfully')
            if (this.appliedTemplate) {
              this.createAppropriateDataForTemplate(projectId)
              this.firebaseTemplatesService.updateProjectTemplate({ downloads: this.appliedTemplate.downloads + 1 }, this.appliedTemplate.id).subscribe(res => { })
            }
            this.createCardSubmitted = false
            this.bsModalRef.hide();
          }, error => {
            console.log('Error: Dashboarded => newcard', error);
            this.createCardSubmitted = false
          })
      }
      this.addActivityLog(payload)
    } else {
      return false;
    }
  }

  async addActivityLog(payload) {
    const newParticipants = payload.participants;
    if(this.selectedCard) {
      const oldParticipants = this.selectedCard.participants;

      if(this.selectedCard.name !== payload.name) {
        this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.RENAMED, ACTIVITY_IDENTIFIER.CARD_RENAMED, this.userDetails.userId, ACTION_TITLE_MAPPER.renamed.replace(/[{()}]/g, '').replace('name', this.selectedCard.name).replace('newName', payload.name), 13).subscribe(res => {})
      }
      if(this.selectedCard.description !== payload.description) {
        this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.CHANGED_THE_DESCRIPTION, ACTIVITY_IDENTIFIER.CARD_CHANGED_DESCRIPTION, this.userDetails.userId, ACTION_TITLE_MAPPER.renamed.replace(/[{()}]/g, '').replace('name', this.selectedCard.description).replace('newName', payload.description), 13).subscribe(res => {})
      }

      const participant_added = [];
      for(let new_p_id of Object.keys(newParticipants)) {
        const oldUser = oldParticipants.find(p => p.id == new_p_id);
        if (oldUser) {
          // means changed admin role or not
          if(oldUser.admin != newParticipants[new_p_id].admin) {
            if(newParticipants[new_p_id].admin) {
              this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.ADMINADD, ACTIVITY_IDENTIFIER.CARD_ADMIN_ADDED, this.userDetails.userId, ACTION_TITLE_MAPPER.adminAdd.replace(/[{()}]/g, '').replace('userId', new_p_id), 13).subscribe(res => {})
            } else {
              this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.ADMINREMOVE, ACTIVITY_IDENTIFIER.CARD_ADMIN_REMOVED, this.userDetails.userId, ACTION_TITLE_MAPPER.adminRemove.replace(/[{()}]/g, '').replace('userId', new_p_id), 13).subscribe(res => {})
            }
          }
        } else {
          const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(new_p_id);
          participant_added.push(user.name.trim());
          if(newParticipants[new_p_id].admin) {
            this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.ADMINADD, ACTIVITY_IDENTIFIER.CARD_ADMIN_ADDED, this.userDetails.userId, ACTION_TITLE_MAPPER.adminAdd.replace(/[{()}]/g, '').replace('userId', new_p_id), 13).subscribe(res => {})
          }
        }
      }
      if(participant_added.length > 0) {
        this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.INVITE, ACTIVITY_IDENTIFIER.CARD_USER_INVITED, this.userDetails.userId, ACTION_TITLE_MAPPER.invite.replace(/[{()}]/g, '').replace('userId', participant_added.join(',')), 13).subscribe(res => {});
      }

      const participant_removed = [];
      for(let old_p of oldParticipants) {
        const newUser = newParticipants[old_p.id];
        if(!newUser) {
          if(old_p.admin) {
            this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.ADMINREMOVE, ACTIVITY_IDENTIFIER.CARD_ADMIN_REMOVED, this.userDetails.userId, ACTION_TITLE_MAPPER.adminRemove.replace(/[{()}]/g, '').replace('userId', old_p.id), 13).subscribe(res => {})
          }
          const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(old_p.id);
          participant_removed.push(user.name.trim());
        }
      }
      if(participant_removed.length > 0) {
        this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.REMOVED, ACTIVITY_IDENTIFIER.CARD_USER_REMOVED, this.userDetails.userId, participant_removed.join(','), 13).subscribe(res => {})
      }

      /*Object.keys(newParticipants).forEach(participant => {
        if(this.involvedPersonsKey.get(`${participant}`)) {
          const index = this.selectedCard.participants.findIndex(user => user.id === participant)
          if(index !== -1) {
            if(this.selectedCard.participants[index].admin && !newParticipants[`${participant}`].admin) {
              this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.ADMINREMOVE, ACTIVITY_IDENTIFIER.CARD_ADMIN_REMOVED, this.userDetails.userId, ACTION_TITLE_MAPPER.adminRemove.replace(/[{()}]/g, '').replace('userId', participant), 13).subscribe(res => {})
            } else if(!this.selectedCard.participants[index].admin && newParticipants[`${participant}`].admin) {
              this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.ADMINADD, ACTIVITY_IDENTIFIER.CARD_ADMIN_ADDED, this.userDetails.userId, ACTION_TITLE_MAPPER.adminAdd.replace(/[{()}]/g, '').replace('userId', participant), 13).subscribe(res => {})
            }  
          }
        }
      })
      this.involvedPersonsKey.forEach((participant, key) => {
        const index = this.selectedCard.participants.findIndex(user => user.id === key)
        if(index === -1) {
          this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.INVITE, ACTIVITY_IDENTIFIER.CARD_USER_INVITED, this.userDetails.userId, ACTION_TITLE_MAPPER.invite.replace(/[{()}]/g, '').replace('userId', `${key}`), 13).subscribe(res => {})
        }
      })
      this.selectedCard.participants.forEach(element => {
        if(!this.involvedPersonsKey.get(`${element.id}`)) {
          this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.REMOVED, ACTIVITY_IDENTIFIER.CARD_USER_REMOVED, this.userDetails.userId, ACTION_TITLE_MAPPER.invite.replace(/[{()}]/g, '').replace('userId', `${element.id}`), 13).subscribe(res => {})
        }
      });*/
    } else {
      const participants = [];
      for(let participant of Object.keys(newParticipants)) {
        if(this.userDetails.userId != participant) {
          if(newParticipants[participant].admin) {
            this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.ADMINADD, ACTIVITY_IDENTIFIER.CARD_ADMIN_ADDED, this.userDetails.userId, ACTION_TITLE_MAPPER.adminAdd.replace(/[{()}]/g, '').replace('userId', participant), 13).subscribe(res => {})
          }
          const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(participant);
          participants.push(user.name.trim());
        }
      }
      /*Object.keys(newParticipants).forEach((participant: any) => {
        
      });*/
      if(participants.length > 0) {
        this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.INVITE, ACTIVITY_IDENTIFIER.CARD_USER_INVITED, this.userDetails.userId, participants.join(','), 13).subscribe(res => {})
      }

      this.activitylogsService.saveActivtyLogs(payload.id, ACTION_MAPPER.CREATED, ACTIVITY_IDENTIFIER.CARD_CREATED, this.userDetails.userId, ACTION_TITLE_MAPPER.created, 13).subscribe(res => {})
    }
  }

  getProjectReference() {
    return new Promise<string>((resolve, reject) => {
      this.firebaseProjectService.getProjectReference().subscribe(res => {
        this.projectId = res.ref.id
        resolve(res.ref.id)
      })
    })
  }

  generateParticipants(secretKey, projectId) {
    let cardExistingParticipents
    if(this.selectedCard) {
      cardExistingParticipents = this.selectedCard.participants
    }
    const participantsObject = {}
    this.involvedPersonsKey.forEach((value, key, map) => {
      const involvedDataObject = {}
      if(this.selectedCard) {
        if(value['newInvolved'] === true) {
          involvedDataObject['secret'] = this.generateSecretForParticipants(secretKey, value['publicKey'])
          involvedDataObject['timestamp'] = new Date()
          involvedDataObject['status'] = 1;
          involvedDataObject['addedBy'] = this.userDetails.userId;
        } else {
          this.selectedCard.participants.forEach(participant => {
            if(participant.id === value['userId']) {
              involvedDataObject['secret'] = participant['secret']
              involvedDataObject['timestamp'] = participant['timestamp']
              involvedDataObject['status'] = participant.status;
              involvedDataObject['addedBy'] = participant.addedBy;
            }
          });
        }
        involvedDataObject['admin'] = value['admin'] ? value['admin'] : false;
      } else {
        involvedDataObject['secret'] = this.generateSecretForParticipants(secretKey, value['publicKey'])
        involvedDataObject['timestamp'] = new Date()
        involvedDataObject['status'] = (key === this.userDetails.userId ? 2 : 1)
        involvedDataObject['admin'] = (key === this.userDetails.userId ? true : (value['admin'] ? value['admin'] : false));
        involvedDataObject['addedBy'] = this.userDetails.userId;
      }
      involvedDataObject['id'] = key
      involvedDataObject['groupId'] = '1'
      involvedDataObject['stared'] = false
      involvedDataObject['projectId'] = projectId
      participantsObject[`${key}`] = involvedDataObject
    })
    return participantsObject
  }

  generateSecretForParticipants (secretKey, userPublicKey) {
    const secret = this.cryptoService.rsaEncryption(secretKey, userPublicKey)
    return secret
  }

  uploadProjectPicture(event) {
    this.projectPicLoader = true
    const file = event.target.files[0];
    const fileName = event.target.files[0].name;
    const filePath = `images/`;
    const fileRef = this.storage.ref(`${filePath}${fileName}`);
    const task = this.storage.upload(`${filePath}${fileName}`, file);
    task
      .snapshotChanges()
      .pipe(takeUntil(this.subscriptionDestroyed$))
      .pipe(
        finalize(() => {
          this.downloadURL = fileRef.getDownloadURL();
          this.downloadURL.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(url => {
            if (url) {
              this.projectPicLoader = false
              this.cardImageUrl = url;
            }
          });
        })
      )
      .subscribe(url => {
        if (url) {
          console.log(url);
        }
      });
  }

  displayInvitePeopele() {
    this.usersArray = [];
    this.involvedPersonsKey.forEach((user) => {
      user['isAllowed'] = this.canEditParticipantRole(user);
      this.usersArray.push(user);
    });
    this.showCreateCard = false;
    this.selectedTab = 0;
  }
  
  canEditParticipantRole(user) {
    if(this.selectedCard) {
      if(this.selectedCard.createdBy == user.userId) {
        return false;
      }
      if(this.userDetails.userId == user.userId) {
        return false;
      }
      if(!this.userDetails.admin) {
        if(user.newInvolved == undefined || user.newInvolved) {
          return true
        } else {
          return false;
        }
      } 
    } else if(this.userDetails.userId == user.userId) {
        return false;
    }
    return true
  }

  displayCreateCard() {
    if (!this.showCreateCard) {
      this.showCreateCard = true
    }
    this.searchText = ''
    if(this.selectedCard) {
    } else {
      this.usersArray.length = 0
    }
  }

  onKeyUp(event: any) {
    clearTimeout(this.typingTimer)
    this.typingTimer = setTimeout(() => {
      this.doneTyping(event.target.value)
    }, 500);
  }

  onKeyDown() {
    clearTimeout(this.typingTimer)
  }

  searchManual() {
    if(this.selectedTab == 0) {
      this.doneTyping(this.serchUserForm.controls['searchStr1'].value)
      return;
    }
    if(this.selectedTab == 1) {
      this.doneTyping(this.serchUserForm.controls['searchStr2'].value)
      return;
    }
    if(this.selectedTab == 2) {
      this.doneTyping(this.serchUserForm.controls['searchStr3'].value)
      return;
    }
  }

  doneTyping (search) {
    this.usersArray.length = 0
    if (search.length > 0) {
      if(this.selectedTab == 0 && this.serchUserForm.controls['searchStr1'].invalid) {
        return;
      }
      if(this.selectedTab == 1 && this.serchUserForm.controls['searchStr2'].invalid) {
        return;
      }
      if(this.selectedTab == 2) {
        this.doLocalSearch(search);
        return;
      }
      this.userSearchLoading = true
      const data = this.searchUserCallable({searchText: search}).subscribe(res => {
        data.unsubscribe()
        res.forEach(user => {
          const userData = JSON.parse(user)
          const oldUser = this.involvedPersonsKey.get(`${userData.userId}`)
          if (oldUser) {
            userData['involved'] = true;
            userData['admin'] = oldUser['admin'];
            userData['newInvolved'] = oldUser['newInvolved'];
          } else {
            userData['involved'] = false;
            userData['admin'] = false;
            userData['newInvolved'] = undefined;
          }
          
          userData['isAllowed'] = this.canEditParticipantRole(userData);
          userData.profileImage = userData.profileImage ? userData.profileImage : `assets/images/user${this.getRandomInt()}.png`;
          const fullName = userData.name + (userData.lastName && userData.lastName != '' ? ' ' + userData.lastName : '');
          userData.fullName = fullName.trim();
          this.usersArray.push(userData)
        });
        this.userSearchLoading = false
      })
    } else {
      //this.displayInvitePeopele();
      if(this.selectedTab == 2) {
        this.usersArray = [...this.oldParticipants];
      } else {
        this.usersArray = [];
      this.involvedPersonsKey.forEach((user) => {
        user['isAllowed'] = this.canEditParticipantRole(user);
        this.usersArray.push(user);
      });
      }
    }
  }

  doLocalSearch(search) {
    this.usersArray = this.oldParticipants.filter(p => {
      
      if(p.fullName.toLowerCase().indexOf(search.toLowerCase()) != -1) {
        const oldUser = this.involvedPersonsKey.get(`${p.userId}`);
        if(oldUser) {
          p['involved'] = true;
          p['admin'] = oldUser['admin'];
          p['newInvolved'] = oldUser['newInvolved'];
        } else {
          p['involved'] = false;
          p['admin'] = false;
          p['newInvolved'] = undefined;
        }
        return true;
      }
      return false;
    })
  }

  setSelectedTab(index) {
    this.selectedTab = index;
    if(index == 2) {
      this.oldParticipants.forEach(p => {
        const oldUser = this.involvedPersonsKey.get(`${p.userId}`);
        if(oldUser) {
          p['involved'] = true;
          p['admin'] = oldUser['admin'];
          p['newInvolved'] = oldUser['newInvolved'];
        } else {
          p['involved'] = false;
          p['admin'] = false;
          p['newInvolved'] = undefined;
        }
      });
      this.usersArray = [...this.oldParticipants];
    } else {
      this.usersArray = [];
      this.involvedPersonsKey.forEach((user) => {
        user['isAllowed'] = this.canEditParticipantRole(user);
        this.usersArray.push(user);
      });
    }
  }

  addPerson(item) {
    if (document.getElementById("btn-"+item.userId).innerHTML === 'Invite') {
      item['newInvolved'] = true;
      item['involved'] = true;
      this.involvedPersonsKey.set(`${item.userId}`, item)
    } else {
      this.involvedPersonsKey.delete(`${item.userId}`)
    }
    document.getElementById("btn-"+item.userId).innerHTML = document.getElementById("btn-"+item.userId).innerHTML === 'Invite' ? 'Cancel' : 'Invite';
  }

  roleSelected (item) {
    if(this.assigningRole === 'admin') {
      if(!this.userDetails.admin) {
        alert('You are not allowed to create/remove admin.')
        return;
      }
      if(document.getElementById("adminRole").innerHTML === "Make Admin") {
        item['admin'] = true;
      } else {
        item['admin'] = false;
      }
      this.involvedPersonsKey.set(`${item.userId}`, item);
    } else if (this.assigningRole === 'remove') {
      item['admin'] = false;
      item['involved'] = false;
      item['newInvolved'] = undefined;
      this.involvedPersonsKey.delete(`${item.userId}`);
    } else {
      this.involvedPersonsKey.set(`${item.userId}`, item)
    }
  }

  getRandomImage () {
    return `assets/images/user${Math.floor(Math.random() * 2) + 1 }.png`
  }

  sortTemplate() {
    let sortBy = this.sortBy;
      if(sortBy == '') {
        sortBy = 'name';
      }
      if(sortBy == 'title') {
        sortBy = 'name';
      }
      if(sortBy == 'createdBy') {
        sortBy = 'creatorName';
      }

      this.projectTemplates.sort((a,b) => {
        let result = (a[sortBy] < b[sortBy]) ? -1 : (a[sortBy] > b[sortBy]) ? 1 : 0;
        return result * this.sortOrder;
      });
  }

  toogleSortOrder() {
    this.sortOrder = -1 * this.sortOrder;
    this.sortTemplate();
  }

  openTemplateDetails(template) {
    this.selectedTemplate = template
    this.templateDetails = true
  }

  useTemplate () {
    this.appliedTemplate = this.selectedTemplate
    this.templateDetails = false
    this.screenSwitchArray = Array(2).fill(false)
    this.screenSwitchArray[0] = true
  }

  removeAppliedTemplate() {
    this.appliedTemplate = null
  }

  async createAppropriateDataForTemplate(projectId) {
    await Promise.all([this.generateFilesBatch(projectId), this.generateNotesBatch(projectId), this.generateTasksBatch(projectId)])
  }

  async generateFilesBatch(projectId) {
    const batch = this.ngFirestore.firestore.batch()
    for(const file of this.appliedTemplate.files) {
      const fileData = {}
      const readStatus = {}
      readStatus[this.userDetails.userId] = true;
      const fireRef = await this.getFilesReference(projectId)
      fileData['id'] = fireRef.id
      fileData['projectId'] = projectId
      fileData['readStatus'] = readStatus
      fileData['createdBy'] = this.userDetails.userId
      fileData['name'] = file.name
      fileData['ext'] = file.ext
      fileData['thumbUrl'] = file.thumbUrl
      fileData['url'] = file.url
      fileData['size'] = file.size
      fileData['timestamp'] = new Date()
      batch.set(fireRef, fileData)
    }
    batch.commit().then(() => {
    })
  }

  async generateTasksBatch(projectId) {
    const batch = this.ngFirestore.firestore.batch()
    for(const task of this.appliedTemplate.tasks) {
      const taskData = {}
      const readStatus = {}
      readStatus[this.userDetails.userId] = true;
      const fireRef = await this.getTasksReference()
      taskData['id'] = fireRef.id
      taskData['projectId'] = projectId
      taskData['description'] = task.description
      taskData['name'] = task.name
      taskData['readStatus'] = readStatus
      taskData['createdBy'] = this.userDetails.userId
      taskData['timestamp'] = new Date()
      taskData['dueDate'] = null
      taskData['isIsStarted'] = false
      taskData['valid'] = true
      await this.generateToDos(task, fireRef.id, projectId)
      batch.set(fireRef, taskData)
    }
    batch.commit().then(() => {
    })
  }

  async generateNotesBatch(projectId) {
    const batch = this.ngFirestore.firestore.batch()
    for(const note of this.appliedTemplate.notes) {
      const noteData = {}
      const readStatus = {}
      readStatus[this.userDetails.userId] = true;
      const noteRef = await this.getNotesReference()
      noteData['id'] = noteRef.id
      noteData['title'] = note.title
      noteData['description'] = note.description
      noteData['readStatus'] = readStatus
      noteData['projectId'] = projectId
      noteData['userId'] = this.userDetails.userId
      noteData['valid'] = true
      noteData['loaded'] = true
      noteData['timestamp'] = new Date()
      noteData['updateTimestamp'] = new Date()
      batch.set(noteRef, noteData)
    }
    batch.commit().then(() => {
    })
  }

  async generateToDos(task, taskId, projectId) {
    if(task.todos.length) {
      const batch = this.ngFirestore.firestore.batch()
      for(const todo of task.todos) {
        const todoData = {}
        const readStatus = {}
        readStatus[this.userDetails.userId] = true;
        const fireRef = await this.getTodosReference(taskId)
        todoData['id'] = fireRef.id
        todoData['title'] = todo.title
        todoData['taskId'] = taskId
        todoData['projectId'] = projectId
        todoData['userId'] = this.userDetails.userId
        todoData['timestamp'] = new Date()
        todoData['isComplete'] = false
        batch.set(fireRef, todoData)
      }
      batch.commit().then(() => {
      })
    }
  }

  getFilesReference(projectId) {
    return new Promise<any>((resolve, reject) => {
      this.ngFirestore.collection('projects').doc(projectId).collection('files').doc().get().subscribe(res => {
        resolve(res.ref)
      })
    })
  }

  getNotesReference() {
    return new Promise<any>((resolve, reject) => {
      this.ngFirestore.collection('notes').doc().get().subscribe(res => {
        resolve(res.ref)
      })
    })
  }

  getTasksReference() {
    return new Promise<any>((resolve, reject) => {
      this.ngFirestore.collection('projectsTasks').doc().get().subscribe(res => {
        resolve(res.ref)
      })
    })
  }

  getTodosReference(taskId) {
    return new Promise<any>((resolve, reject) => {
      this.ngFirestore.collection('projectsTasks').doc(taskId).collection('todo').doc().get().subscribe(res => {
        resolve(res.ref)
      })
    })
  }

  onWheel(event: WheelEvent): void {
    this.scrollWrapper.nativeElement.scrollLeft += event.deltaY;
    event.preventDefault();
  }

  getSecretKey(userEditing) {
    return new Promise<string>((resolve, reject) => {
      let taskSecretKey = this.ngFireFunctions.httpsCallable('getTaskSecretKey');
      taskSecretKey({ secret: userEditing.secret, publicKey: this.cryptoService.rsaKeyGeneration.rsaPublicKey }).subscribe(async (response) => {
        if (response) {
          const rsaDecryptKey = await this.cryptoService.rsaKeyGeneration.decrypt(response);
          resolve(rsaDecryptKey)
        }
      }, err => {
        throw(err)
      });
    })
    
  }

  getParticipantById(userId) {
    //return this.allParticipant.find(participant => participant.userId == userId)
    return new Promise((resolve, reject) => {
      const user = this.involvedPersonsKey.get(userId);
      if (user) {
        resolve(user)
      } else {
        this.ngFirestore.collection('users').doc(userId).get().subscribe(res => {
          resolve(res.data())
        })
      }
    })
  }

  getRandomInt() {
    return Math.floor(Math.random() * Math.floor(3)) + 1;
  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
    if(this.getParticipantsSub) {
      this.getParticipantsSub.unsubscribe()
    }
    if(this.getCardSub) {
      this.getCardSub.unsubscribe()
    }
    
  }
}
