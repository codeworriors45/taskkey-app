import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';
import { tap, switchMap, map, skip } from 'rxjs/operators';
import { AngularFireAuth } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class FirebaseTemplatesService {
  

  constructor(
    private ngFirestore: AngularFirestore,
    private afAuth: AngularFireAuth
  ) { }

    getAndListenAllTemplates(limit: number): Observable<any> {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection('templates').snapshotChanges()
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                }),
                map(a => a.map(templateData => {
                    if (templateData.payload.doc.exists) {
                        const data = templateData.payload.doc.data() as any;
                        const name = data.project.name
                        const id = templateData.payload.doc.id;
                        const exists = templateData.payload.doc.exists;
                        return { ...data, exists, id, name } as any;
                    }
                }),
                )
            );
    }

    updateProjectTemplate(templateData: any, templateRef: string) {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection("templates").doc(templateRef).set(templateData, { merge: true });
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }
}
