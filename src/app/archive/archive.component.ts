import { Component, OnInit } from '@angular/core';
import { Store } from '@ngxs/store';
import { CardsState } from '../stateManagement/cards/cards.state';
import { takeUntil, switchMap, map, filter } from 'rxjs/operators';
import { Subject, Subscription } from 'rxjs';
import { FirebaseUserService } from '../services/firebaseUser.service';
import * as moment from 'moment';
import { FirebaseProjectService } from '../services/firebaseProject.service';

@Component({
  selector: 'app-archive',
  templateUrl: './archive.component.html',
  styleUrls: ['./archive.component.scss']
})
export class ArchiveComponent implements OnInit {
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  public currentUser: any;
  archiveCards: any[] = [];
  totalArchiveCards: any[] = [];
  public typingTimer: any
  public searchLoader = false
  getAllProjectsSub
  archiveCardsSub: Subscription;

  constructor(
    private store: Store,
    private firebaseUserService: FirebaseUserService,
    private firebaseProjectService: FirebaseProjectService,
  ) {
    
    const subs = this.firebaseUserService.getCurrentUser().subscribe((userData) => {
      subs.unsubscribe();
      this.currentUser = userData;
      this.loadCards();
    }, err => {
      subs.unsubscribe();
      console.log(err);
    });
   }

  ngOnInit(): void {
  }

  loadCards() {
    if(this.archiveCardsSub) {
      this.archiveCardsSub.unsubscribe()
    }
    this.archiveCardsSub = this.firebaseProjectService.getAllArchiveProjects().pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((cards) => {
      if (cards) {
        setTimeout(() => {
          const newCards = [];
          if (cards.length) {
            cards.forEach(async (card) => {
              if(card.completed) {
                let timestamp = card.completeTimestamp ? card.completeTimestamp : card.timestamp;
                if (timestamp) {
                  const miliseconds = parseInt((timestamp.seconds * 1000).toString()) + parseInt((timestamp.nanoseconds / 1000000).toString());
                  timestamp = moment(miliseconds).format("MMM D y");
                }
                const acronymName = await this.getUserNameAcronym(card.createdBy);
                newCards.push({ ...card, completed: timestamp, acronymName })
              }
            });
            this.totalArchiveCards = newCards
            this.archiveCards = newCards;
          } else {
            this.archiveCards = [];
          }
        }, 0);
      }
    });
  }

  getUserNameAcronym(userId) {
    return new Promise<string>((resolve, reject) => {
      this.firebaseUserService.getUserById(userId).subscribe(userData => {
        const user = userData.data();
        const fullName = user.name + (user.lastName && user.lastName != '' ? ' ' + user.lastName : '');
        resolve(this.getAcronym(fullName.trim()));
      }, err => {
        console.log(err);
        resolve('');
      })
    })
  }

  getAcronym(name) {
    return name
      .split(/\s/)
      .reduce((accumulator, word) => accumulator + word.charAt(0), '');
  }

  onKeyUp(event: any) {
    clearTimeout(this.typingTimer)
    this.typingTimer = setTimeout(() => {
      this.doneTyping(event.target.value)
    }, 1000);
  }

  onKeyDown() {
    clearTimeout(this.typingTimer)
  }

  doneTyping (search) {
    if(search.length) {
      this.searchLoader = true
      this.archiveCards = []
      for(const card of this.totalArchiveCards) {
        if(card.name.includes(search)) {
          this.archiveCards.push(card)
        }
      }
      this.searchLoader = false
    } else {
      this.searchLoader = false
      this.archiveCards = this.totalArchiveCards
    }
  }

  unarchiveCard(card) {
    this.firebaseProjectService.updateProject({completed: false}, card.id).subscribe(res => {
      this.loadCards()
    })
  }
}
