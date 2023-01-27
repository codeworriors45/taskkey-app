import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';
import { tap, switchMap, map, skip } from 'rxjs/operators';
import { AngularFireAuth } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class FirebasechatService {
  getChatsSub: Subscription;


  constructor(
    private ngFirestore: AngularFirestore,
    private afAuth: AngularFireAuth
  ) { }

    getAndListenAllChatById(projectId: string, limit: number): Observable<any> {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection('chats', ref => ref.where('projectId', '==', projectId).orderBy('timestamp', 'desc').limit(limit)).snapshotChanges()
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                }),
                map(a => a.map(chatData => {
                    if (chatData.payload.doc.exists) {
                        const data = chatData.payload.doc.data() as any;
                        const id = chatData.payload.doc.id;
                        const exists = chatData.payload.doc.exists;
                        return { ...data, id, exists } as any;
                    }
                }),
                )
            );
    }

    getPaginationOfChat(projectId: string, limit: number, skip: any): Observable<any> {
        return this.afAuth.user
            .pipe(
                switchMap(fbUser => {
                    if (fbUser) {
                        return this.ngFirestore.collection('chats', ref => ref.where('projectId', '==', projectId).orderBy('timestamp', 'desc').limit(limit).startAfter(skip.timestamp)).get()
                    } else {
                        throw new Error('Firebase Authentication User not found');
                    }
                })
            );
    }
}
