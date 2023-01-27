import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireFunctions } from '@angular/fire/functions';
import { Store } from '@ngxs/store';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as moment from 'moment';

import { CryptoService } from '../../../services/crypto.service';
import { CardsState } from '../../../stateManagement/cards/cards.state';
import { FirebaseUserService } from '../../../services/firebaseUser.service';
import { FirebaseProjectService } from '../../../services/firebaseProject.service';
import { FirebasenotesService } from 'src/app/services/firebasenotes.service';
import { ActivitylogsService } from '../../../services/activitylogs.service';
import { ACTION_MAPPER, ACTION_TITLE_MAPPER } from '../../../interfaces/activity.action';
import { ACTIVITY_IDENTIFIER } from '../../../interfaces/activity.identifiers';

@Component({
  selector: 'app-notes',
  templateUrl: './notes.component.html',
  styleUrls: ['./notes.component.scss']
})
export class NotesComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() projectId: string = '';
  @ViewChild('notesContent') notesContentDiv: ElementRef;
  @ViewChild('newNotesContent') newNotesContent: ElementRef;
  @ViewChild('operationDropdownPopup') operationDropdownPopup: ElementRef;
  @ViewChild('notesTitle') notesTitle: ElementRef;
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  loadDataSubs: Subscription;
  getParticipantsSub: Subscription;

  participantsRefreshed = false;

  currentUser: any;
  rsaDecryptKey: any;
  
  notes: any[] = [];
  filteredNotes: any[] = [];
  selectedNote: any;
  
  sortBy = '';
  sortOrder = 1;

  filterOptions = {
    participants: []
  };
  selectedProjectAllParticipants: any[] = [];
  filterApplied = false;

  showAddNote = false;
  setInnetHTMLInterval: any;
  setReadStatusTimer: any;

  noteForm: FormGroup;
  formSubmitted = false;

  constructor(
    private store: Store,
    private ngFirestore: AngularFirestore,
    private ngFireFunctions: AngularFireFunctions,
    private cryptoService: CryptoService,
    private firebaseProjectService: FirebaseProjectService,
    private firebaseUserService: FirebaseUserService,
    private formBuilder: FormBuilder,
    private firebasenotesService: FirebasenotesService,
    private activitylogsService: ActivitylogsService
  ) {
    this.initForm();
    const subs = this.firebaseUserService.getCurrentUser().subscribe((userData) => {
      subs.unsubscribe();
      this.currentUser = userData;
      this.getTaskSecretKey();
    }, err => {
      subs.unsubscribe();
      console.log(err);
    })
  }

  ngOnInit() {
    //this.loadData();
  }

  ngAfterViewInit() {
    //if(this.selectedNote) {
      //this.notesContentDiv.nativeElement.innerHTML = this.selectedNote.description
    //}
  }

  ngOnChanges() {
  }

  initForm() {
    this.noteForm = this.formBuilder.group({
      title: new FormControl('', {
        validators: [Validators.required],
      }),
      description: new FormControl('')
    });
  }

  getTaskSecretKey() {
    const project = this.store.selectSnapshot(CardsState.getProjectById(this.projectId));

    const userParticipant = project.participants.find((participant) => this.currentUser.userId == participant.id);

    if(userParticipant) {
      let taskSecretKey = this.ngFireFunctions.httpsCallable('getTaskSecretKey');

      taskSecretKey({secret: userParticipant.secret, publicKey: this.cryptoService.rsaKeyGeneration.rsaPublicKey}).subscribe(async (response) => {
        this.rsaDecryptKey =  await this.cryptoService.rsaKeyGeneration.decrypt(response);
        this.loadData();
      });
    }   
  }

  loadData() {
    this.participantsRefreshed = true;

    if(this.getParticipantsSub) {
      this.getParticipantsSub.unsubscribe();
    }
    this.store.select(CardsState.getProjectById(this.projectId)).pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(async (card) => {
      setTimeout(async () => {
        const allParticipant = [];
        for (let participant of card.participants) {
          const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(participant.id)
          allParticipant.push({ ...user, ...participant, selected: false });
        }
        if (!this.participantsRefreshed) {
          const mappedParticipants = allParticipant.map((participant) => {
            const searchedParticipant = this.filterOptions.participants.find(p => p.userId == participant.userId)
            return { ...participant, selected: searchedParticipant ? searchedParticipant.selected : false };
          })
          this.selectedProjectAllParticipants = [...mappedParticipants];
          this.filterOptions.participants = [...mappedParticipants];
          this.filterNotes();
        } else {
          this.selectedProjectAllParticipants = [...allParticipant];
          this.filterOptions.participants = [...allParticipant];
          this.filterApplied = false;
        }
        const isCardAdmin = this.isCurrentUserCardAdmin();
        this.filteredNotes.forEach(async note => {
          const createdBy = this.selectedProjectAllParticipants.find((participant) => participant.userId == note.userId);
          if (createdBy) {
            const fullName = createdBy.name + (createdBy.lastName && createdBy.lastName != '' ? ' ' + createdBy.lastName : '');
            note._createdBy = fullName.trim();
            note.profileImage = createdBy.profileImage ? createdBy.profileImage : `assets/images/user${this.getRandomInt()}.png`;
          } else {
            const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(note.id)
            note._createdBy = user.fullName;
            note.profileImage = user.profileImage
          }
          note.isAllowed = isCardAdmin || (note.userId == this.currentUser.userId);
        })
        this.participantsRefreshed = false;
      }, 0);
    });
    if (this.loadDataSubs) {
      this.loadDataSubs.unsubscribe();
    }
    this.loadDataSubs = this.firebasenotesService.getAndListenAllNotesById(this.projectId).pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(async (notesData) => {
      const isCardAdmin = this.isCurrentUserCardAdmin();
      const mappedNotes = await Promise.all(notesData.map(async (note): Promise<any> => {
        const createdBy = this.selectedProjectAllParticipants.find((participant) => participant.userId == note.userId);
        let miliseconds = 0;
        let updateTimeString = '-';

        let decryptedTitle = '';
        let decryptedDescription = '';

        //debugger
        try {
          if(note.title) {
            note.title  = note.title.replace(/\n/g, "");
            decryptedTitle = this.cryptoService.decryptData(note.title, this.rsaDecryptKey);

            if(decryptedTitle == '') {
              decryptedTitle = note.title;
            }
          }
        } catch(e) {
          decryptedTitle = note.title;
        }
        
        try {
          if(note.description) {
            note.description  = note.description.replace(/\n/g, "");
            decryptedDescription = this.cryptoService.decryptData(note.description, this.rsaDecryptKey);

            if(decryptedDescription == '') {
              decryptedDescription = note.description;
            }
          }
        } catch(e) {
          decryptedDescription = note.description;
        }

        if (note.timestamp && note.timestamp.seconds) {
          miliseconds = parseInt((note.timestamp.seconds * 1000).toString()) + parseInt((note.timestamp.nanoseconds / 1000000).toString());
        }
        if (note.updateTimestamp && note.updateTimestamp.seconds) {
          const stmap = moment(parseInt((note.updateTimestamp.seconds * 1000).toString()) + parseInt((note.updateTimestamp.nanoseconds / 1000000).toString()));
          
          if(stmap.diff(moment(new Date()), 'days') === 0) {
            updateTimeString = `Last updated Today at ${stmap.format('h:mm a')}`
          } else if(stmap.diff(moment(new Date()), 'days') === -1) {
            updateTimeString = `Last updated Yesterday at ${stmap.format('h:mm a')}`
          } else if(stmap.diff(moment(new Date()), 'days') < -1 && stmap.diff(moment(new Date()), 'days') > -7) {
            updateTimeString = `Last updated ${stmap.format('dddd')} at ${stmap.format('h:mm a')}`
          } else {
            updateTimeString = `Last updated ${stmap.format('d MMMM y')} at ${stmap.format('h:mm a')}`
          }
        }
        if(createdBy) {
          //return {...note, timestamp: moment(miliseconds).format("MMM D y [at] h:mm a"), updateTime: updateTimeString, owner: note.userId === this.currentUser.userId, _createdBy: fullName.trim(), profileImage: createdBy.profileImage }
          return {...note, title: decryptedTitle, description: decryptedDescription, _timestamp: moment(miliseconds).format("MMM D y [at] h:mm a"), updateTime: updateTimeString, isAllowed: isCardAdmin || (note.userId == this.currentUser.userId), _createdBy: createdBy.fullName, profileImage: createdBy.profileImage }
        } else {
          const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(note.userId)

          //return {...note, timestamp: moment(miliseconds).format("MMM D y [at] h:mm a"), updateTime: updateTimeString, owner: note.userId === this.currentUser.userId, _createdBy: '', profileImage: `assets/images/user${this.getRandomInt()}.png` }
          return {...note, title: decryptedTitle, description: decryptedDescription, _timestamp: moment(miliseconds).format("MMM D y [at] h:mm a"), updateTime: updateTimeString, isAllowed: isCardAdmin || (note.userId == this.currentUser.userId), _createdBy: user.fullName, profileImage: user.profileImage }
        }
      }));
      this.notes = [...mappedNotes];
      this.filteredNotes = [...mappedNotes];
      this.filterNotes();

      if(this.selectedNote == undefined && this.filteredNotes.length > 0) {
        this.setSelectedNote(this.filteredNotes[0]);
      } else {
        let selectedNoteDeleted = true;
        this.filteredNotes.forEach(note => {
          if(note.id == this.selectedNote.id) {
            selectedNoteDeleted = false;
            this.setSelectedNote(note);
          }
        });
        if(selectedNoteDeleted) {
          this.setSelectedNote(null);
        }
      }
      /*if(this.selectedNote) {
        let selectedTaskDeleted = true;
        this.notes.forEach(task => {
          if(task.id == this.selectedNote.id) {
            selectedTaskDeleted = false;
          }
        });
        if(!selectedTaskDeleted) {
          this.notesContentDiv.nativeElement.innerHTML = this.filteredNotes[0].description
        }
      }
      if(this.filteredNotes.length) {
        this.selectedNote = this.filteredNotes[0]
        this.selectedTab = 1
      } else {
        this.selectedNote = {title: 'N/A', updateTime: 'N/A', _createdBy: 'N/A', description: 'N/A'}
        this.selectedTab = 2
      }*/
    }, err => {
      console.log(err)
    })
  }

  isCurrentUserCardAdmin() {
    const currentUser = this.selectedProjectAllParticipants.find((participant) => participant.userId == this.currentUser.userId);
    if(currentUser.admin) {
      return true;
    }
    return false;
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
    filterDropdown.show();
  }

  applyFiletrDropDown() {
    const mappedParticipants = this.filterOptions.participants.map(f_partipant => {
      const searchedParticipant = this.selectedProjectAllParticipants.find(partipant => f_partipant.userId == partipant.userId);
      return {...searchedParticipant, selected: searchedParticipant.selected ? true : false}
    })
    this.filterOptions.participants = [...mappedParticipants];
    this.filterNotes();
    this.filterApplied = true;
  }

  filterNotes() {
    this.filteredNotes = this.notes.filter((note) => {
      let participantFoundInFilter = false;
      const selectedParticipantInFilterOpt = this.filterOptions.participants.filter(participant => participant.selected);
      selectedParticipantInFilterOpt.forEach(filterParticipant => {
        if (filterParticipant.selected) {
          if (note.userId === filterParticipant.userId) {
            participantFoundInFilter = true;
          }
        }
      });
      if(selectedParticipantInFilterOpt.length == 0) {
        participantFoundInFilter = true;
      }
      return participantFoundInFilter;
    });
    this.sortNotes();
  }

  resetFilterDropDown() {
    const mappedParticipants = this.selectedProjectAllParticipants.map((participant) => {
      return {...participant, selected: false};
    });
    this.selectedProjectAllParticipants = [...mappedParticipants];
    this.filterOptions.participants = [...mappedParticipants];
    this.filteredNotes = this.notes;
    this.filterApplied = false;
    this.sortNotes();
  }

  sortNotes() {
    let sortBy = this.sortBy;
    if(sortBy == '') {
      sortBy = 'title';
    }
    if(sortBy == 'createdBy') {
      sortBy = '_createdBy';
    }

    if(sortBy == 'updated') {
      sortBy = 'updateTimestamp';
    }

    this.filteredNotes.sort((a,b) => {
      let result = (a[sortBy] > b[sortBy]) ? -1 : (a[sortBy] < b[sortBy]) ? 1 : 0;
      return result * this.sortOrder;
    });
  }

  toogleSortOrder() {
    this.sortOrder = -1 * this.sortOrder;
    this.sortNotes();
  }

  openNoteOperationDropDown(dropDown) {
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

  getRandomInt() {
    return Math.floor(Math.random() * Math.floor(3)) + 1;
  }

  setSelectedNote(note) {
    this.selectedNote = note;

    if(this.selectedNote) {
      this.formSubmitted = false;

      //this.noteForm.value.title = this.selectedNote.title;
      //this.noteForm.value.description = this.selectedNote.description;

      this.noteForm.patchValue({
        title: note.title,
        description: note.description
      })

      clearInterval(this.setInnetHTMLInterval);
      this.setInnetHTMLInterval = setInterval(() => {
        if(this.notesContentDiv) {
          clearInterval(this.setInnetHTMLInterval);
          this.notesContentDiv.nativeElement.innerHTML = this.selectedNote.description.replace(/\n/g, "<br/>");
          this.notesTitle.nativeElement.innerHTML = this.selectedNote.title.replace(/\n/g, "<br/>");
          if(this.selectedNote.isAllowed) {
            this.notesContentDiv.nativeElement.focus();
          }
        }
      }, 200);

      clearTimeout(this.setReadStatusTimer)
      if(!note.readStatus) {
        this.setReadStatusTimer = setTimeout(() => {
          const readStatus = {};
          readStatus[this.currentUser.userId] = true;
          note.readStatus = readStatus;
          this.setReadStatus(note);
        });
      } else if(!note.readStatus[this.currentUser.userId]) {
        this.setReadStatusTimer = setTimeout(() => {
          const readStatus = {};
          readStatus[this.currentUser.userId] = true;
          note.readStatus = readStatus;
          this.setReadStatus(note);
        });
      }
    }
    
    
    /*this.selectedTab = 1;
    if(this.selectedNote.owner) {
      this.editinAvailable = false
    } else {
      this.editinAvailable = true
    }
    this.noteForm.patchValue({
      id: note.id,
      title: note.title,
      timestamp_DB: note.timestamp ?  new Date(note.timestamp.split('at')[0]) : null,
      createdBy: note.userId,
      admin: note.admin
    })
    this.notesContentDiv.nativeElement.innerHTML = this.selectedNote.description.replace(/\n/g, "<br/>");
    */
  }

  setReadStatus(note) {
    const data = {
      readStatus: note.readStatus
    }
    this.ngFirestore.collection('notes').doc(note.id).set(data, { merge: true }).then(() => {
    });
  }

  startCreateNote() {
    this.selectedNote = null;
    this.showAddNote = true;
    this.initForm();

    clearInterval(this.setInnetHTMLInterval);
    this.setInnetHTMLInterval = setInterval(() => {
      if(this.newNotesContent) {
        clearInterval(this.setInnetHTMLInterval);
        this.newNotesContent.nativeElement.innerHTML = '';
      }
    }, 200);

    this.formSubmitted = false;
  }

  onTextChange (message) {
    this.noteForm.value.description = message;
  }

  allowOnly60Chars(evt) {
    if(this.noteForm.value.title && this.noteForm.value.title.length >= 60) {
      if(!(evt.key == 'ArrowLeft' || evt.key == 'ArrowRight' || evt.key == 'ArrowUp' || evt.key == 'ArrowDown' || evt.key == 'Delete' || evt.key == 'Backspace')) {
        evt.preventDefault();
      }
    } 
  }

  onTitleChange (message) {
    this.noteForm.value.title = message;
  }

  async addOrUpdateNote() {
    if(this.noteForm.valid && !this.formSubmitted) {
      const formValues = this.noteForm.value;

      const readStatus = {};
      readStatus[this.currentUser.userId] = true;

      const title = formValues.title.trim();
      if(title.length) {
        this.formSubmitted = true;

        const encyptedTitle = await this.cryptoService.encryptData(title, this.rsaDecryptKey);

        const description = formValues.description.trim();
        const encyptedDescription = description.length ? await this.cryptoService.encryptData(description, this.rsaDecryptKey) : '';

        const noteId = this.selectedNote ? this.selectedNote.id : await this.getNoteReference();

        const data = {
          id: noteId,
          loaded: true,
          projectId: this.projectId,
          readStatus: readStatus,
          title: encyptedTitle,
          timestamp: this.selectedNote ? this.selectedNote.timestamp : new Date(),
          userId: this.selectedNote ? this.selectedNote.userId : this.currentUser.userId,
          valid: true,
          description: encyptedDescription,
          updateTimestamp: new Date()
        }
        if(this.selectedNote) {
          if(this.selectedNote.title !== title) {
            this.activitylogsService.saveActivtyLogs(this.selectedNote.projectId, ACTION_MAPPER.NOTERENAMED, ACTIVITY_IDENTIFIER.NOTE_RENAMED, this.currentUser.userId, ACTION_TITLE_MAPPER['note_renamed'].replace(/[{()}]/g, '').replace('old', this.selectedNote.title).replace('new', title), 13, this.selectedNote.projectId).subscribe(res => {})
          }
        } else {
          this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.NOTECREATED, ACTIVITY_IDENTIFIER.NOTE_CREATED, this.currentUser.userId, ACTION_TITLE_MAPPER['note_created'].replace(/[{()}]/g, '').replace('notetitle', title), 13, this.projectId).subscribe(res => {})
        }
        const noteDocRef = this.ngFirestore.collection('notes').doc(noteId);
        noteDocRef.set(data, { merge: true }).then(() => {
          this.formSubmitted = false;
          this.initForm();
          this.showAddNote = false;
          alert('Saved successfully!')
        }, err => {
          console.log(err);
          this.formSubmitted = false;
        });
      }
    }
  }

  getNoteReference() {
    return new Promise<string>((resolve, reject) => {
      this.ngFirestore.collection('notes').doc().get().subscribe(res => {
        resolve(res.ref.id)
      })
    })
  }

  cancleNotesUpdate() {
    this.initForm();
    this.notesContentDiv.nativeElement.innerHTML = this.selectedNote.description.replace(/\n/g, "<br/>");
  }

  cancelNewNote() {
    this.initForm();
    this.newNotesContent.nativeElement.innerHTML = '';
  }

  deleteNote(note) {
    if(note.isAllowed) {
      this.ngFirestore.collection('notes').doc(note.id).delete().then(() => {
      })
      this.activitylogsService.saveActivtyLogs(this.selectedNote.projectId, ACTION_MAPPER.NOTEDELETED, ACTIVITY_IDENTIFIER.NOTE_DELETED, this.currentUser.userId, ACTION_TITLE_MAPPER['note_deleted'].replace(/[{()}]/g, '').replace('notetitle', note.title), 13, this.selectedNote.projectId).subscribe(res => {})
    } else {
      alert('You are not allowed to delete note!')
    }
  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
  }
}
