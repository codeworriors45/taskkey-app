import { Injectable } from '@angular/core';
import { State, Action, StateContext, NgxsOnInit, Selector, createSelector } from '@ngxs/store';
import { tap, switchMap, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/auth';
import { NgxsFirestore } from '@ngxs-labs/firestore-plugin';
import { AngularFirestore } from '@angular/fire/firestore';


import { GetAllCards, GetCard, GetAllOnce,
    SetAllCards, 
    SetAllTasks,
    SetFileStats,
    SetProjectDueDates, 
    UpdateProjectTasks, 
    SetHomeDataLoaded, 
    ClearHomeData,
    SetSelectedProjectAllParticipants,
    DeleteTask,
    SetSelectedProjectAllNotes,
    DeleteNote
} from './cards.action';

import {
    NgxsFirestoreConnect,
    Connected,
    Emitted,
    Disconnected,
    StreamConnected,
    StreamEmitted,
    StreamDisconnected
} from '@ngxs-labs/firestore-plugin';
import { Card } from 'src/app/interfaces/card.interface';

import { CardsFirestoreService } from 'src/app/services/cards-firestore.service';
import { patch, insertItem, iif, updateItem } from '@ngxs/store/operators';

export class CardsStateModel {
    cards: any[];
    tasks: any[];
    loadedInitialUserData: boolean;
    selectedProjectAllParticipants: any[];
    secretKey: string;
    selectedProjectsAllNotes: any[]
    fileStats: any;
}

@State<CardsStateModel>({
    name: 'home',
    defaults: {
        cards: [],
        tasks: [],
        loadedInitialUserData: false,
        selectedProjectAllParticipants: [],
        secretKey: '',
        selectedProjectsAllNotes: [],
        fileStats: {
            total: 0,
            new: 0
        }
    }
})
@Injectable()
export class CardsState implements NgxsOnInit {
    @Selector()
    static _getCards(state: CardsStateModel) {
        return state.cards;
    }

    static getCards() {
        return createSelector([CardsState], (state: CardsStateModel) => {
            return state.cards;
        });
    }

    static getfileStats() {
        return createSelector([CardsState], (state: CardsStateModel) => {
            return state.fileStats;
        });
    }

    constructor(
        public cardFS: CardsFirestoreService,
        public ngxsFirestoreConnect: NgxsFirestoreConnect,
        public ngFireAuth: AngularFireAuth,
        public ngFirestore: AngularFirestore
    ) { }

    ngxsOnInit(ctx: StateContext<CardsStateModel>) {
        this.ngxsFirestoreConnect.connect(GetAllCards, {
            to: () => this.cardFS.collection$(),
            connectedActionFinishesOn: 'FirstEmit'
        });

        this.ngxsFirestoreConnect.connect(GetCard, {
            to: (action) => this.cardFS.doc$(action.payload)
        });
    }

    @Action(StreamConnected(GetAllCards))
    getAllConnected(ctx: StateContext<CardsStateModel>, { action }: Connected<GetAllCards>) {
        console.log('[Cards] Connected');
    }

    @Action(StreamEmitted(GetAllCards))
    getAllEmitted(ctx: StateContext<CardsStateModel>, { action, payload }: Emitted<GetCard, any[]>) {
        ctx.setState(patch({ cards: payload }));
    }

    @Action(StreamDisconnected(GetAllCards))
    getAllDisconnected(ctx: StateContext<CardsStateModel>, { action }: Disconnected<GetAllCards>) {
        console.log('[Cards] Disconnected');
    }

    //Get
    @Action(StreamEmitted(GetCard))
    get(ctx: StateContext<CardsStateModel>, { action, payload }: Emitted<GetCard, any>) {
        ctx.setState(
            patch<CardsStateModel>({
                cards: iif(
                    (cards) => !!cards.find((card) => card.id === payload.id),
                    updateItem((card) => card.id === payload.id, patch(payload)),
                    insertItem(payload)
                )
            })
        );
    }

    @Action([GetAllOnce]) /** Not in use */
    getAllOnce({ patchState }: StateContext<CardsStateModel>) {
        this.ngFireAuth.user
            .pipe(
                switchMap(user => this.ngFirestore.collection('users').doc(user.uid).collection('cards').snapshotChanges()),
                map(a => a.map(cardData => {
                    if (cardData.payload.doc.exists) {
                        const data = cardData.payload.doc.data() as any;
                        const id = cardData.payload.doc.id;
                        const exists = cardData.payload.doc.exists;
                        console.log(data)
                        return { ...data, id, exists } as any;
                    }
                }),
                )
            ).subscribe((cards) => {
                //console.log(cards);
                patchState({ cards });
                //const state = ctx.getState();
                return of(cards)
            });

        /*tap((cards) => {
                console.log(cards);
                //patchState({ cards: cards });
                const state = ctx.getState();
                ctx.patchState({
                    ...state,
                    cards: cards,
                  });
            }

        .subscribe((cards) => {
            console.log(cards);
            const state = ctx.getState();
            return ctx.patchState({
                ...state,
                cards: cards,
              });
            return setState({
                ...state,
                cards: cards,
            });
        })*/
        /*return this.ngFireAuth.user.pipe(
            tap((user) => {
                this.cardFS.doc$(user.uid).pipe(
                    tap((cards) => {
                        console.log(cards)
                        //patchState({ cards });
                    })
                  )
            })
          )*/

        /*return this.cardFS.collectionOnce$().pipe(
          tap((cards) => {
            patchState({ cards });
          })
        );*/

    }

    @Action([SetAllCards])
    setAllCards({ patchState }: StateContext<CardsStateModel>, cards) {
        return patchState({ cards: cards.payload });
    }

    @Action([SetFileStats])
    setFileStats({ patchState }: StateContext<CardsStateModel>, payload) {
        return patchState({ fileStats: payload.fileStats });
    }

    @Action([SetAllTasks])
    setAllTasks(ctx: StateContext<CardsStateModel>, action: SetAllTasks) {
        let tasks = action.payload;
        /*tasks.forEach((task) => {
            if(task.dueDate) {
                task.dueDate = parseInt((task.dueDate.seconds*1000).toString()) + parseInt((task.dueDate.nanoseconds/1000000).toString())
            } else {
                task.dueDate = 0;
            }
        })*/

        const mappedTasks = this.mapsTaskData(tasks);

        ctx.patchState({ tasks: mappedTasks });

        //return ctx.dispatch(new SetProjectDueDates());
    }

    mapsTaskData(tasks) {
        return tasks.map((task) => {
            let dueDate = 0;
            if(task.dueDate) {
                dueDate = parseInt((task.dueDate.seconds*1000).toString()) + parseInt((task.dueDate.nanoseconds/1000000).toString())
            }

            const participantsArr = [];
            for (const participantId in task.participants) {
                participantsArr.push(task.participants[participantId]);
            }

            let status = 'pending';
            if(task.completed) {
                status =  'completed';
            } else if(dueDate) {
              if(new Date(dueDate) < new Date()) {
                status =  'overdue';
              } else if(task.isStarted) {
                status = 'in-progress';
              }
            } else if(task.isStarted) {
              status = 'in-progress';
            }

            return {...task, status, participants: participantsArr, dueDate}
          });
    }

    @Action([SetProjectDueDates])
    setProjectDueDates(ctx: StateContext<CardsStateModel>) {
        const state = ctx.getState();
        let cards = [...state.cards];
        let tasks = [...state.tasks];
        //console.clear();
        const mappedCards = cards.map((card) => {
            const projectTasks = tasks.filter((task) => {
                return task.projectId == card.id;
            });
            return this.mapProjectData(projectTasks, card);
        });

        ctx.patchState({
            ...state,
            cards: mappedCards
        });
    }

    mapProjectData(projectTasks, card) {
        let numberOfPendingTask = 0;
        projectTasks.forEach((task) => {
            if(!task.completed) {
                numberOfPendingTask = numberOfPendingTask + 1;
            }
        });
        
        if(projectTasks.length) {
            const dueDate = projectTasks.reduce((max, p) => p.dueDate > max ? p.dueDate : max, projectTasks[0].dueDate);
            return { ...card, projectDueDate: dueDate ? new Date(dueDate) : null, numberOfPendingTask, totalTasks: projectTasks.length };
        }
        return { ...card, projectDueDate: null, numberOfPendingTask, totalTasks: projectTasks.length };
    }

    @Action([UpdateProjectTasks])
    updateTask(ctx: StateContext<CardsStateModel>, action: UpdateProjectTasks) {
        const state = ctx.getState();
        const projectTasks = action.payload;
        /*projectTasks.forEach((task) => {
            if(task.dueDate) {
                task.dueDate = parseInt((task.dueDate.seconds*1000).toString()) + parseInt((task.dueDate.nanoseconds/1000000).toString())
            } else {
                task.dueDate = 0;
            }
        })*/
        const mappedTasks = this.mapsTaskData(projectTasks);
        
        const projectId = action.projectId;

        const cards = [...state.cards];
        const tasks = [...state.tasks];
        let card = cards.find((card) => card.id == projectId);
        
        /*if(mappedTasks.length) {
            const dueDate = mappedTasks.reduce((max, p) => p.dueDate > max ? p.dueDate : max, mappedTasks[0].dueDate);
            card = { ...card, projectDueDate: dueDate ? new Date(dueDate) : null };
        } else {
            card = { ...card, projectDueDate: null };
        }*/

        card = this.mapProjectData(mappedTasks, card);

        cards[cards.findIndex(el => el.id === card.id)] = card;

        mappedTasks.forEach((task) => {
            tasks[tasks.findIndex(el => el.id === task.id)] = task;
        })
        

        ctx.patchState({
            ...state,
            cards,
            tasks
        });
    }

    static getTasksByProjectId(projectId) {
        return createSelector([CardsState], (state: CardsStateModel) => {
            return state.tasks.filter((task) => task.projectId == projectId);
        });
    }

    static getProjectById(projectId) {
        return createSelector([CardsState], (state: CardsStateModel) => {
            return state.cards.find((card) => card.id == projectId);
        });
    }
    
    @Action([SetHomeDataLoaded])
    setHomeDataLoaded({ patchState }: StateContext<CardsStateModel>) {
        return patchState({ loadedInitialUserData: true });
    }

    static isHomeDataLoaded() {
        return createSelector([CardsState], (state: CardsStateModel) => {
            return state.loadedInitialUserData;
        });
    }

    @Action([ClearHomeData])
    clearHomeData({ patchState }: StateContext<CardsStateModel>) {
        return patchState({
            cards: [],
            tasks: [],
            loadedInitialUserData: false,
            selectedProjectAllParticipants: [],
            fileStats: {
                total: 0,
                new: 0
            }
        });
    }

    @Action([SetSelectedProjectAllParticipants])
    setSelectedProjectAllParticipants(ctx: StateContext<CardsStateModel>, action: SetSelectedProjectAllParticipants) {
        return ctx.patchState({
            selectedProjectAllParticipants: [...action.participants]
        });
    }

    @Action([DeleteTask])
    deleteTask(ctx: StateContext<CardsStateModel>, action: DeleteTask) {
        const taskId = action.taskId;
        const state = ctx.getState();
        const allTasks = [...state.tasks];

        const index = allTasks.findIndex(task => task.id == taskId);
        allTasks.splice(index, 1);

        return ctx.patchState({
            tasks: allTasks
        });
    }

    static getUserById(userId) {
        return createSelector([CardsState], (state: CardsStateModel) => {
            return state.selectedProjectAllParticipants.find((user) => user.userId == userId);
        });
    }

    static getParticipants() {
        return createSelector([CardsState], (state: CardsStateModel) => {
            return state.selectedProjectAllParticipants;
        });
    }

    @Action([SetSelectedProjectAllNotes])
    SetSelectedProjectAllNotes(ctx: StateContext<CardsStateModel>, action: SetSelectedProjectAllNotes) {
        return ctx.patchState({
            selectedProjectsAllNotes: [...action.notes]
        });
    }

    static getNotes() {
        return createSelector([CardsState], (state: CardsStateModel) => {
            return state.selectedProjectsAllNotes
        });
    }

    @Action([DeleteNote])
    deleteNote(ctx: StateContext<CardsStateModel>, action: DeleteNote) {
        const noteId = action.noteId;
        const state = ctx.getState();
        const allNotes = [...state.selectedProjectsAllNotes];

        const index = allNotes.findIndex(note => note.id == noteId);
        allNotes.splice(index, 1);

        return ctx.patchState({
            selectedProjectsAllNotes: allNotes
        });
    }
}

