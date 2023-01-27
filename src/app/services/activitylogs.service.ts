import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
import { switchMap } from 'rxjs/operators';


@Injectable({
  providedIn: 'root'
})
export class ActivitylogsService {

  constructor(
    private afAuth: AngularFireAuth,
    private ngFirestore: AngularFirestore
  ) { }

  saveActivtyLogs(projectRef, action, activityIdentifier, createdBy, title, widgetType, contentId?) {
    const activity = {}
    const readStatus = {}
    readStatus[createdBy] = true;
    activity['action'] = action
    activity['activityIdentifier'] = activityIdentifier
    activity['createdBy'] = createdBy
    activity['projectId'] = projectRef
    activity['title'] = title
    activity['timestamp'] = new Date()
    activity['widgetType'] = widgetType
    activity['readStatus'] = readStatus
    if (contentId) {
      activity['contentId'] = contentId
    }
    const activityRef = this.ngFirestore.collection("projects").doc(projectRef).collection('activities').doc()
    activity['id'] = activityRef.ref.id
    return this.afAuth.user
      .pipe(
        switchMap(fbUser => {
          if (fbUser) {
            return activityRef.set(activity)
          } else {
            throw new Error('Firebase Authentication User not found');
          }
        })
      );
    // this.saveLogs(projectRef, activity, activityRef)
  }

  saveLogs(projectId, logData, logRef) {
    return this.afAuth.user
      .pipe(
        switchMap(fbUser => {
          if (fbUser) {
            return this.ngFirestore.collection("projects").doc(projectId).collection('activities').doc(logRef).set(logData)
          } else {
            throw new Error('Firebase Authentication User not found');
          }
        })
      );
  }
}
