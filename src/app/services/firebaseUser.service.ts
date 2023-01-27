import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AngularFireAuth } from '@angular/fire/auth';
import * as moment from 'moment';

import { User } from '../interfaces/user.interface';
import { FirebaseProjectService } from './firebaseProject.service'

@Injectable({ providedIn: 'root' })
export class FirebaseUserService {

    getAllParticipantsbyIdsSub: Subscription;

    constructor(
        private afs: AngularFirestore,
        private afAuth: AngularFireAuth,
        private firebaseProjectService: FirebaseProjectService
    ) {
        
    }


    getCurrentUser_old(): Observable<any> {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.afs.collection<User>('users')
                            .doc(fbUser.uid).get().pipe(
                                map(user => {
                                    return user.data()
                                })
                            );
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }

    getCurrentUser(): Observable<any> {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return new Observable<any>((observer) => {
                            //setInterval(() => observer.next(new Date().toString()), 1000);
                            const user = this.firebaseProjectService.getParticipantById(fbUser.uid);
                            if(user) {
                                observer.next(user);
                                //observer.complete();
                            } else {
                                this.afs.collection('users').doc(fbUser.uid).snapshotChanges().subscribe(res => {
                                    let user: any = res.payload.data();
                                    try {
                                        const pUserIndex = this.firebaseProjectService.allParticipants.findIndex(p => p.userId == user.userId);
                                        if(pUserIndex == -1) {
                                            user.profileImage = user.profileImage ? user.profileImage : `assets/images/user${this.firebaseProjectService.getRandomInt()}.png`;
                                            const fullName = user.name + (user.lastName && user.lastName != '' ? ' ' + user.lastName : '');
                                            user.fullName = fullName.trim();
                                            user.acronymName = this.firebaseProjectService.getAcronym(user.fullName);
                                            this.firebaseProjectService.allParticipants.push(user)
                                        } else {
                                            if(user.profileImage) {
                                                user.profileImage = user.profileImage;
                                            }
                                            const fullName = user.name + (user.lastName && user.lastName != '' ? ' ' + user.lastName : '');
                                            user.fullName = fullName.trim();
                                            user.acronymName = this.firebaseProjectService.getAcronym(user.fullName);
                                            
                                            this.firebaseProjectService.allParticipants[pUserIndex] = user;
                                        }
                                        observer.next(user);
                                        //observer.complete();
                                    } catch(e) {
                                        console.log(e);
                                        observer.next(user);
                                    }
                                    
                                })
                            }
                        });
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
        
    }

    getUserById(userId): Observable<any> {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.afs.collection<User>('users')
                            .doc(userId).get();
                    } else {
                        throw new Error('Firebase Auth User not found');
                    }
                })
            );
    }

    getUserByIdForGuard(uid: string): Observable<any | null> {
        return this.afs.collection<User>('users')
            .doc(uid).snapshotChanges()
            .pipe(
                map(user => {
                    if (user.payload.exists) {
                        const data = user.payload.data() as User;
                        const id = user.payload.id;
                        const exists = user.payload.exists;
                        return { ...data, id, exists } as any;
                    }
                    return null;
                })
            );
    }

    addOrUpdateUserData(userData: any) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        const data: User = {
                            userId: userData.uid,
                            email: userData.email ? userData.email : '',
                            profileImage: userData.profileImage ? userData.profileImage : '',
                            name: userData.displayName.split(" ")[0] ? userData.displayName.split(" ")[0] : '',
                            phone: userData.phoneNumber ? userData.phoneNumber : '',
                            lastName: userData.displayName.split(" ")[1] ? userData.displayName.split(" ")[1] : '',
                            publicKey: userData.publicKey ? userData.publicKey : '',
                            uuid: userData.uuid ? userData.uuid : '',
                            timeStamp: userData.timeStamp || moment().valueOf()
                        }
                        return this.afs.collection<User>('users')
                            .doc(fbUser.uid).set(data, { merge: true });
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }

    setLoggedInState(isLoggedIn) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        const data: any = {
                            loggedIn: isLoggedIn
                        }
                        return this.afs.collection<User>('users')
                            .doc(fbUser.uid).set(data, { merge: true });
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }

    setOnlineState(isOnline) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        const data: any = {
                            isOnline: isOnline
                        }
                        return this.afs.collection<User>('users')
                            .doc(fbUser.uid).set(data, { merge: true });
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }

    getAllParticipantsbyIds(userIds: string[]) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.afs.collection('users', ref => ref.where('userId', 'in', userIds)).snapshotChanges()
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                }),
                map(a => a.map(tasksData => {
                    if (tasksData.payload.doc) {
                        const data = tasksData.payload.doc.data() as any;
                        const id = tasksData.payload.doc.id;
                        //console.log(data)
                        return { ...data, id } as any;
                    }
                }),
                )
            );
    }

    getOnlyAllParticipantsbyIds(userIds: string[]) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.afs.collection('users', ref => ref.where('userId', 'in', userIds)).get()
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }

}
