import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/auth';
import { map, switchMap } from 'rxjs/operators';
import firebase from 'firebase/app';

import { User } from '../interfaces/user.interface';
import { FirebaseUserService } from '../services/firebaseUser.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private afAuth: AngularFireAuth,
    private router: Router,
    private firebaseUserService: FirebaseUserService
  ) {
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> {
    let fbUser: firebase.User | null;
    return this.afAuth.user
      .pipe(
        switchMap(fbUserDoc => {
          if (fbUserDoc) {
            fbUser = fbUserDoc;
            return this.firebaseUserService.getUserByIdForGuard(fbUser.uid);
          } else {
            return of(null);
          }
        }),
        map((user: User | null) => {
          if (!user) {
            if (fbUser) {
              //console.log('REDIRECT => GUARD HAS FB-USER BUT NO USER: ', fbUser.uid);
              const url = state.url;
              console.log(url, route);
              
              /*if (url.indexOf('userProfile') === -1) {
                //Redirect to force user to save data at firestore
                this.router.navigateByUrl('./userProfile');
              }*/
              
              //this.afAuth.signOut()
              // Not needed because handled in app.component.ts with "afAuth.onAuthStateChanged"
              /*
              .then(() => {
                this.router.navigateByUrl('/auth/login');
              });*/

              setTimeout(() => {
                this.router.navigateByUrl('/app/dashboard/home?popup=setting');
              }, 0);
              return true;
            } else {
              this.afAuth.signOut()
              // Not needed because handled in app.component.ts with "afAuth.onAuthStateChanged"
              /*.then(() => {
                this.router.navigateByUrl('/auth/login');
              });*/
              return false;
            }
          } else {
            //console.log('CONTINUE => GUARD HAS FB-USER AND USER: ', user);
            return true;
          }
        })
      );
  }

}
