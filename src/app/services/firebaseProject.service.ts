import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable, Subscription, forkJoin } from 'rxjs';
import { tap, switchMap, map, skip, debounceTime, distinctUntilChanged, take } from 'rxjs/operators';
import { AngularFireAuth } from '@angular/fire/auth';
import { Store } from '@ngxs/store';
import firebase from 'firebase/app';

import { CardsState } from './../stateManagement/cards/cards.state';
import { SetAllCards, SetAllTasks, SetProjectDueDates, UpdateProjectTasks, SetHomeDataLoaded } from 'src/app/stateManagement/cards/cards.action';

import { User } from '../interfaces/user.interface';

import { FirebaseTaskService } from './firebaseTask.service';

@Injectable({ providedIn: 'root' })
export class FirebaseProjectService {
    getAllProjectsSub: Subscription;
    projectDataRefreshed: boolean = false;
    allParticipants: any[] = [];
    allParticipantsSubs: Subscription[] = [];
    //selectedProjectParticipants: any[] = [];

    constructor(
        private ngFirestore: AngularFirestore,
        private afAuth: AngularFireAuth,
        private store: Store,
        private firebaseTaskService: FirebaseTaskService
    ) {
    }

    loadAllUserData() {
        console.log('--------on App load or Manual => loadAllUserData-------');
        try {
            if (this.getAllProjectsSub) {
                this.getAllProjectsSub.unsubscribe();
            }
        } catch (err) {
            console.log(err);
        }

        this.getAllProjectsSub =
            this.getAllProjects().subscribe(async (projects) => {
                console.log('getAllProjects() => Subscription');
                if(projects == null) {
                    return;
                }

                const mappedProjects = projects.map((project) => {
                    const participantsArr = [];
                    let completion = 0
                    for (const participantId in project.participants) {
                        participantsArr.push(project.participants[participantId]);
                    }
                    if(project.progress?.completion) {
                        completion = project.progress.completion
                    }
                    return { ...project, numberOfTasks: 0, participants: participantsArr, totalParticipants: participantsArr.length, completion}
                });

                const uniqueParticipantIds = [];
                mappedProjects.forEach(card => {
                    if(card.participants) {
                    card.participants.forEach(participant => {
                        if(uniqueParticipantIds.indexOf(participant.id) == -1) {
                        uniqueParticipantIds.push(participant.id)
                        }
                    });
                    }
                })
                for(let userId of uniqueParticipantIds) {
                    await this.addOrUpdateUserGloblly(userId);
                }
                
                this.store.dispatch(new SetAllCards(mappedProjects));
                this.store.dispatch(new SetHomeDataLoaded());
            }, error => {
                console.log(error);
            })
    }

    getNotesCount(id, unread) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if(fbUser) {
                        if (unread) {
                            return this.ngFirestore.collection('notes', ref => ref.where('projectId', '==', id).where(`readStatus.${fbUser.uid}`, '==', true)).snapshotChanges()
                        } else {
                            return this.ngFirestore.collection('notes', ref => ref.where('projectId', '==', id)).snapshotChanges()
                        }
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }

    getProjectById(projectId, userId) {
        return new Promise((resolve, reject) => {
            this.ngFirestore.collection('projects', ref => 
                ref.where('id', '==', projectId)
                .where('completed', '==', false)
                .where(`participants.${userId}.id`, '==', userId)
                .where(`participants.${userId}.status`, '==', 2)
            ).get().subscribe(res => {
                resolve(res)
            })
        }); 
    }

    getAllProjects(): Observable<any> {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection('projects', ref => ref.where(`participants.${fbUser.uid}.id`, '==', fbUser.uid).where('completed', '==', false)).snapshotChanges().pipe()
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                }),
                map(a => a.map(cardData => {
                    if (cardData.payload.doc) {
                        const data = cardData.payload.doc.data() as any;
                        const id = cardData.payload.doc.id;
                        //console.log(data)
                        return { ...data, id } as any;
                    }
                }),
                )
            );
    }

    addProject(cardData: any, projectRef: string) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection("projects").doc(projectRef).set(cardData, { merge: true });
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }

    updateProject(cardData: any, projectRef: string) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection("projects").doc(projectRef).set(cardData, { merge: true });
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }

    updateProjectNotMerge(cardData: any, projectRef: string) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection("projects").doc(projectRef).set(cardData);
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }

    getProjectReference() {
        return this.afAuth.user
            .pipe(
                (fbUser) => {
                    if (fbUser) {
                        const projectRef = this.ngFirestore.collection("projects").doc();
                        return projectRef.get()
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                }
            );
    }

    deleteParticipant(cardData: any, projectRef: string) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection("projects").doc(projectRef).set(cardData);
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }

    _deleteParticipant(projectId: string, participantId: string) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection("projects").doc(projectId).update({
                            [`participants.${participantId}`]: firebase.firestore.FieldValue.delete()
                        });
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }

    getAllArchiveProjects(): Observable<any> {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection('projects', ref => ref.where(`participants.${fbUser.uid}.id`, '==', fbUser.uid).where('completed', '==', true).limit(50)).snapshotChanges().pipe()
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                }),
                map(a => a.map(cardData => {
                    if (cardData.payload.doc) {
                        const data = cardData.payload.doc.data() as any;
                        const id = cardData.payload.doc.id;
                        //console.log(data)
                        return { ...data, id } as any;
                    }
                }),
                )
            );
    }

    getParticipantById(userId) {
        return this.allParticipants.find(p => p.userId == userId);
    }

    addOrUpdateUserGloblly(userId) {
        return new Promise((resolve, reject) => {
            const index = this.allParticipants.findIndex(p => p.userId == userId);
            if (index == -1) {
                const participantsSubs = this.ngFirestore.collection('users').doc(userId).snapshotChanges().subscribe(res => {
                    this.allParticipantsSubs.push(participantsSubs);
                    let user: any = res.payload.data();
                                        
                    const pUserIndex = this.allParticipants.findIndex(p => p.userId == user.userId);
                    if(pUserIndex == -1) {
                        user.profileImage = user.profileImage ? user.profileImage : `assets/images/user${this.getRandomInt()}.png`;
                        const fullName = user.name + (user.lastName && user.lastName != '' ? ' ' + user.lastName : '');
                        user.fullName = fullName.trim();
                        user.acronymName = this.getAcronym(user.fullName);
                        this.allParticipants.push(user)
                    } else {
                        if(user.profileImage) {
                            user.profileImage = user.profileImage;
                        }
                        const fullName = user.name + (user.lastName && user.lastName != '' ? ' ' + user.lastName : '');
                        user.fullName = fullName.trim();
                        user.acronymName = this.getAcronym(user.fullName);

                        this.allParticipants[pUserIndex] = user;
                    }
                    resolve(true)
                })
            } else {
                resolve(true)
            }
        })
    }

    getUserById_N_addOrUpdateUserGloblly(userId) {
        return new Promise((resolve, reject) => {
            const index = this.allParticipants.findIndex(p => p.userId == userId);
            if (index == -1) {
                const participantsSubs = this.ngFirestore.collection('users').doc(userId).snapshotChanges().subscribe(res => {
                    this.allParticipantsSubs.push(participantsSubs);
                    let user: any = res.payload.data();
                    if(!user) {
                        resolve(userId);
                    } else {
                        try {
                            const pUserIndex = this.allParticipants.findIndex(p => p.userId == user.userId);
                            if(pUserIndex == -1) {
                                user.profileImage = user.profileImage ? user.profileImage : `assets/images/user${this.getRandomInt()}.png`;
                                const fullName = user.name + (user.lastName && user.lastName != '' ? ' ' + user.lastName : '');
                                user.fullName = fullName.trim();
                                user.acronymName = this.getAcronym(user.fullName);
                                this.allParticipants.push(user)
                            } else {
                                if(user.profileImage) {
                                    user.profileImage = user.profileImage;
                                }
                                const fullName = user.name + (user.lastName && user.lastName != '' ? ' ' + user.lastName : '');
                                user.fullName = fullName.trim();
                                user.acronymName = this.getAcronym(user.fullName);
    
                                this.allParticipants[pUserIndex] = user;
                            }
                            resolve(user)
                        }  catch(e) {
                            console.log(e)
                            resolve(userId)
                        }
                    }
                })
            } else {
                resolve(this.allParticipants[index])
            }
        })
    }
    
    getRandomInt() {
        return Math.floor(Math.random() * Math.floor(3)) + 1;
    }

    getAcronym(name) {
        return name
          .split(/\s/)
          .reduce((accumulator, word) => accumulator + word.charAt(0), '');
    }

}
