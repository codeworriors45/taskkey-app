import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { AngularFireAuth } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
export class FirebaseFileService {
    getFilesByProjectIdSub: Subscription;

    constructor(
        private ngFirestore: AngularFirestore,
        private afAuth: AngularFireAuth) {
    }

    getAllFilesById(projectId) {
        return this.ngFirestore.collection('projects').doc(projectId).collection(`files`, ref => ref.where('projectId', '==', projectId)).get()
    }

    getAndListenAllFilesById(projectId): Observable<any> {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection('projects').doc(projectId).collection(`files`, ref => ref.where('projectId', '==', projectId)).snapshotChanges()
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                }),
                map(a => a.map(tasksData => {
                    if (tasksData.payload.doc.exists) {
                        const data = tasksData.payload.doc.data() as any;
                        const id = tasksData.payload.doc.id;
                        //console.log(data)
                        return { ...data, id } as any;
                    }
                }),
                )
            );
    }

}
