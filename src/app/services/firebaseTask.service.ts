import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';
import { tap, switchMap, map } from 'rxjs/operators';
import { AngularFireAuth } from '@angular/fire/auth';

import { User } from '../interfaces/user.interface';

@Injectable({ providedIn: 'root' })
export class FirebaseTaskService {
    getTasksByProjectIdSubs: Subscription[] = [];

    constructor(
        private ngFirestore: AngularFirestore,
        private afAuth: AngularFireAuth) {
    }

    getAllTaskById(projectId) {
        return this.ngFirestore.collection('projectsTasks', ref => ref.where('projectId', '==', projectId)).get()
    }

    getAndListenAllTaskById(projectId): Observable<any> {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection('projectsTasks', ref => ref.where('projectId', '==', projectId)).snapshotChanges()
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

    getAssignedTask() {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection('projectsTasks', ref => ref.where(`participants.${fbUser.uid}.id`, '==', fbUser.uid)).snapshotChanges()
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

}
