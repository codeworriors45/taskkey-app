import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd,RouterEvent } from '@angular/router';

import { Observable, Subscription } from 'rxjs';
import { CarouselConfig } from 'ngx-bootstrap/carousel';
import { Store, Select } from '@ngxs/store';
import { Subject, of } from 'rxjs';
import { takeUntil, switchMap, map, filter } from 'rxjs/operators';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import * as moment from 'moment';


import { SettingsComponent } from './../settings/settings.component';
import { CreateCardComponent } from './create-card/create-card.component';

import { Card } from '../interfaces/card.interface';
import { CardsState } from '../stateManagement/cards/cards.state';
import { AppEventService } from '../services/event.service';
import { FirebaseUserService } from 'src/app/services/firebaseUser.service';
import { FirebaseProjectService } from 'src/app/services/firebaseProject.service';
import { ActivitylogsService } from '../services/activitylogs.service';
import { ACTION_MAPPER, ACTION_TITLE_MAPPER } from '../interfaces/activity.action'
import { ACTIVITY_IDENTIFIER } from '../interfaces/activity.identifiers'

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  //@Select(CardsState.getCards) cards: Observable<any[]>;
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  menuClosed: boolean = true;
  @ViewChild('pageContent') pageContent: ElementRef;

  size: number = 0;
  currentUser: any;
  allCards: any[] = [];
  activeCards: any[] = [];
  newCards: any[] = [];
  slideArray: any[] = [];
  itemsPerSlide = 4;
  singleSlideOffset = false;
  filterOption: string = 'active';
  projectId: string = '';
  selectedNewCardId: string = '';
  selectedProjectAllParticipants: any[] = [];
  sideMenuTimer: any;
  getCardTimer: any;
  //taskCompletedPercentage = 0;
  getTasksByProjectIdSub: Subscription;
  getParticipantsSub: Subscription;
  getCardSub: Subscription;
  activeSlide = 0;
  setActiveIndexTimer: any;
  isNightTime = false;
  checkTimeInterval: any;

  constructor(
    private store: Store,
    private route: ActivatedRoute,
    private router: Router,
    private modalService: BsModalService,
    private appEventService: AppEventService,
    private firebaseUserService: FirebaseUserService,
    private firebaseProjectService: FirebaseProjectService,
    private activitylogsService: ActivitylogsService
  ) {
    this.checkIsNight();
    clearInterval(this.checkTimeInterval);
    this.checkTimeInterval = setInterval(() => {
      this.checkIsNight();
    }, 10000);
    

    this.appEventService.toogledSideMenuEmitter.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((sideMenuState) => {
      this.menuClosed = sideMenuState.menuClosed;
      clearTimeout(this.sideMenuTimer)
      this.sideMenuTimer = setTimeout(() => {
        this.createSlideItems(this.calculateNumberOfItemsInSlide());
      }, 1000);
    });

    this.appEventService.onClickCardFilter.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((cardFilter) => {
      this.filterOption = cardFilter.value;
      this.showCard();
    });

    this.appEventService.openCreateCardPopup.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(() => {
      this.openCreateCardPopup();
    });


    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntil(this.subscriptionDestroyed$)).subscribe((endUrl: NavigationEnd) => {
      const currentUrl = endUrl.urlAfterRedirects;
      if(currentUrl.indexOf('app/dashboard/c/') != -1) {
        const foundAt = currentUrl.indexOf('/c/');
        if(currentUrl.indexOf('/t/') == -1) {
          this.projectId = currentUrl.slice(foundAt+3);
        } else {
          const index = currentUrl.indexOf('/t/');
          this.projectId = currentUrl.slice(foundAt+3, index);
        }
        if(this.projectId !== '' && this.projectId !== undefined && this.projectId !== null) {
          this.mapSelectedProjectData()
        }
      } else {
        this.projectId = '';
      }
    });
  }

  ngOnInit(): void {
    this.route
      .queryParams.pipe(takeUntil(this.subscriptionDestroyed$))
      .subscribe(params => {
        // Defaults to 0 if no query param provided.
        if(params['popup'] == 'setting') {
          this.openSettingPopup();
        }
        if(params['popup'] == 'createcard') {
          this.openCreateCardPopup()
        }
      });
  }

  ngAfterViewInit() {
    const subs = this.firebaseUserService.getCurrentUser().subscribe((userData) => {
      subs.unsubscribe();
      this.currentUser = userData;
      this.loadCards();
    }, err => {
      subs.unsubscribe();
      console.log(err);
    });
  }

  checkIsNight() {
    const currentTime = new Date();
    if(currentTime.getHours() > 17 || currentTime.getHours() < 8) {
      this.isNightTime = true;
    } else {
      this.isNightTime = false;
    }
  }

  loadCards() {
    const cards$ = this.store.select(
      CardsState.getCards()
    );
    cards$.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((cards) => {
      clearTimeout(this.getCardTimer);
      this.getCardTimer = setTimeout(() => {
        const activeCards = [];
        const newCards = [];
        if(cards.length) {
          cards.forEach((card) => {
            const user = card.participants.find(participant => participant.id == this.currentUser.userId);
            if(user) {
              if(user.status != 1) {
                const acronymName = this.getCardNameAcronym(card.name);
                activeCards.push({...card, acronymName});
              } else {
                let timestamp = card.timestamp;
                if (card.timestamp) {
                  const miliseconds = parseInt((card.timestamp.seconds * 1000).toString()) + parseInt((card.timestamp.nanoseconds / 1000000).toString());

                  timestamp = moment(miliseconds).calendar();
                  if(timestamp.indexOf('/') !== -1) {
                    timestamp =  moment(miliseconds).format("MMM D [at] h:mm a");
                  }
                }
                newCards.push({...card, timestamp, acronymName: '', invitedBy: user.addedBy})
              }
            }
          });
          this.activeCards = activeCards;
          this.newCards = newCards;
          this.allCards = cards;
          if(newCards.length == 0) {
            this.appEventService.toogleNoNewCardView(true, this.filterOption);
          } else {
            this.appEventService.toogleNoNewCardView(false, this.filterOption);
            this.newCards.forEach(async card => {
              card.acronymName = await this.getUserNameAcronym(card.invitedBy);
            })
          }
        } else {
          this.allCards = [];
          this.activeCards = [];
          this.newCards = [];
          this.slideArray = [];
        }
        this.createSlideItems(this.calculateNumberOfItemsInSlide());
      }, 0);
    });
  }

  mapSelectedProjectData() {    
    if(this.getCardSub) {
      this.getCardSub.unsubscribe();
    }
    this.getCardSub = this.store.select(CardsState.getProjectById(this.projectId)).subscribe(async (card) => {
      const participants = [];
      if(card?.participants) {
        for(let participant of card.participants) {
          const user = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(participant.id);
          participants.push(user);
        };
      }
      this.selectedProjectAllParticipants = participants;
    })

    /*if(this.getTasksByProjectIdSub) {
      this.getTasksByProjectIdSub.unsubscribe();
    }
    this.getTasksByProjectIdSub = this.store.select(CardsState.getTasksByProjectId(this.projectId)).subscribe((tasks) => {
      const totalTask = tasks.length;
      let completedTasksNum = 0;
      if (totalTask != 0) {
        tasks.forEach(task => {
          if(task.completed) {
            completedTasksNum = completedTasksNum + 1;
          }
        });
        let percentage = (completedTasksNum * 100)/totalTask;
        this.taskCompletedPercentage = parseInt(percentage.toString());
      } else {
        this.taskCompletedPercentage = 0;
      }
      
    });*/
  }

  openSettingPopup() {
    this.modalService.show(SettingsComponent);
  }

  openCreateCardPopup() {
    this.modalService.show(CreateCardComponent);
  }

  onResize(evt) {
    this.createSlideItems(this.calculateNumberOfItemsInSlide());
  }

  calculateNumberOfItemsInSlide() {
    //debugger;
    const availableWidth = this.pageContent.nativeElement.offsetWidth;
    const availableHeight = this.pageContent.nativeElement.offsetHeight;
   
    //console.log('Width:' + availableWidth);
    //console.log('Height: ' + availableHeight);
    const size = parseInt(((availableWidth-130)/390).toString());
    //console.log(size);
    this.size = size;

    return size;
  }

  createSlideItems(size) { //Numbe of items in a slide
    const cardsToDisplay = this.filterOption == 'active' ? this.activeCards : this.newCards;
    console.log('cardsToDisplay: ', cardsToDisplay)
    const totalCardsLength = cardsToDisplay.length;
    const numberOfSlides = parseInt((totalCardsLength/size).toString()) + (totalCardsLength%size == 0? 0:1);
    //console.clear()
    //console.log(numberOfSlides);

    let gfg = new Array(numberOfSlides);
    for (var i = 0; i < gfg.length; i++) {
      if(((i*size)+size) <= cardsToDisplay.length-1) {
        gfg[i] = cardsToDisplay.slice((i*size), (i*size)+size);
      } else {
        gfg[i] = cardsToDisplay.slice((i*size));
      }
      //console.log((i*size), (i*size)+size);
    }
    //console.log(gfg);
    //console.log(this.activeCards);
    this.slideArray = gfg;
    if(this.projectId !== '' && this.projectId !== undefined && this.projectId !== null) {
      this.setActiveCarouselIndex()
    }
  }

  setActiveCarouselIndex() {
    let index = 0;
    this.slideArray.forEach((slide, i) => {
      slide.forEach((project) => {
        if(project.id == this.projectId) {
          index = i;
        }
      });
    });
    clearTimeout(this.setActiveIndexTimer);
    this.setActiveIndexTimer = setTimeout(() => {
      this.activeSlide = index;
    }, 1000);
    
  }

  showCard() {
    this.createSlideItems(this.calculateNumberOfItemsInSlide());
    if(this.newCards.length == 0) {
      this.appEventService.toogleNoNewCardView(true, this.filterOption);
    } else {
      this.appEventService.toogleNoNewCardView(false, this.filterOption);
    }
  }

  onCardClick(card) {
    if(this.filterOption == 'active') {
      this.goToProject(card);
    } else {
      this.selectedNewCardId = card.id;
    }
  }

  goToProject(card) {
    if (card.id !== this.projectId) {
      this.selectedProjectAllParticipants = [];
    }
    this.router.navigateByUrl(`app/dashboard/c/${card.id}`);
  }

  acceptNewProject(card) {
    const participants_DB = {};
    card.participants.forEach(c_participant => {
      const participant = {...c_participant};
      if(this.currentUser.userId == participant.id) {
        participant.status = 2;
      }
      participants_DB[participant.id] = participant;
    });

    const card_DB = {
      participants: participants_DB
    }
    const newCardsLength = this.newCards.length;
    this.firebaseProjectService.updateProject(card_DB, card.id).subscribe(() => {
      this.selectedNewCardId = null;
      this.activitylogsService.saveActivtyLogs(card.id, ACTION_MAPPER.CARDJOINED, ACTIVITY_IDENTIFIER.CARD_USER_ACCEPTED, this.currentUser.userId, ACTION_TITLE_MAPPER['joined the card.'], 13).subscribe(res => {})
      /*if(newCardsLength == 1) {
        this.selectedNewCardId = null;
        this.filterOption = 'active';
        this.createSlideItems(this.calculateNumberOfItemsInSlide());
      }*/
    }, err => console.log(err));
  }

  _declineNewProject(card) {
    const participants_DB = {};
    card.participants.forEach(c_participant => {
      const participant = {...c_participant};
      if(this.currentUser.userId != participant.id) {
        participants_DB[participant.id] = participant;
      }
    });

    const card_DB = {
      participants: participants_DB
    }
    const newCardsLength = this.newCards.length;
    this.firebaseProjectService.deleteParticipant(card_DB, card.id).subscribe(() => {
      if(newCardsLength == 1) {
        this.selectedNewCardId = null;
        this.filterOption = 'active';
        this.createSlideItems(this.calculateNumberOfItemsInSlide());
      }
    }, err => console.log(err));
  }

  getUserNameAcronym(userId) {
    return new Promise<string>(async (resolve, reject) => {
      const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(userId);
      resolve(user.acronymName)
    })
  }

  getCardNameAcronym(cardName) {
    const names = cardName.split(' ')
    if (names[1]) {
      return (names[0].charAt(0) + names[1].charAt(0)).toUpperCase()
    } else {
      return (names[0].charAt(0)).toUpperCase()
    }
  }

  getAcronym(name) {
    return name
      .split(/\s/)
      .reduce((accumulator, word) => accumulator + word.charAt(0), '');
  }

  declineNewProject(card) {
    const newCardsLength = this.newCards.length;
    this.firebaseProjectService._deleteParticipant(card.id, this.currentUser.userId).subscribe((res) => {
      console.log(res)
      this.selectedNewCardId = null;
      this.activitylogsService.saveActivtyLogs(card.id, ACTION_MAPPER.CARDDECLINED, ACTIVITY_IDENTIFIER.CARD_USER_DECLINED, this.currentUser.userId, ACTION_TITLE_MAPPER['cardDecline'], 13).subscribe(res => {})

      /*if(newCardsLength == 1) {
        this.selectedNewCardId = null;
        this.filterOption = 'active';
        this.createSlideItems(this.calculateNumberOfItemsInSlide());
      }*/
    }, err => console.log(err));
  }

  ngOnDestroy() {
    if(this.getTasksByProjectIdSub) {
      this.getTasksByProjectIdSub.unsubscribe();
    }
    if(this.getParticipantsSub) {
      this.getParticipantsSub.unsubscribe()
    }
    if(this.getCardSub) {
      this.getCardSub.unsubscribe();
    }
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
    clearInterval(this.checkTimeInterval);
  }
}
