import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/auth';
import firebase from 'firebase/app';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/firestore';

import { WindowService } from '../shared/window.service'
import { User } from '../interfaces/user.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public windowRef: any;
  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private router: Router,
    private window: WindowService
  ) { }

  initRecaptchaVerifier_login() {
    this.windowRef = this.window.windowRef;
    if(!this.windowRef.recaptchaVerifier) {
      this.windowRef.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'invisible',
        'callback': (response) => {
          // reCAPTCHA solved, allow signInWithPhoneNumber
        }
      });
    }
  }

  getRecaptchaVerifier() {
    return this.windowRef.recaptchaVerifier
  }

  googleSignIn() {
    return this.authLogin(new firebase.auth.GoogleAuthProvider());
  }

  appleSignIn() {
    return this.authLogin(new firebase.auth.OAuthProvider('apple.com'));
  }

  getAppRootUrl() : string {
    console.log(window.location.href)
		return window.location.href + '?emailLogin=success&email=';
  }

  sendMagicLink(email:string){
    //console.log("Send magic link calling")
    return this.afAuth.sendSignInLinkToEmail(email, {
      url: this.getAppRootUrl() + email,
      handleCodeInApp: true
    });
  }

  isSignInWithEmailLink() {
    return this.afAuth.isSignInWithEmailLink(window.location.href);
  }

  signInWithEmailLink(email) {
    return this.afAuth.signInWithEmailLink(email, window.location.href);
  }

  authLogin(provider) {
    return this.afAuth.signInWithPopup(provider);
  }

  signInWithPhoneNumber(phoneNumber) {
    const appVerifier = this.windowRef.recaptchaVerifier;
    return firebase.auth().signInWithPhoneNumber(phoneNumber, appVerifier)
  }

  logout() {
    return this.afAuth.signOut();
  }

  _redirectIfUserLoggedIn() {
    this.afAuth.user.subscribe(user => {
      if(user) {
        //this.router.navigateByUrl('/app/dashboard');
      }
    })
  }
  _updateUserData(user) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(`users/${user.uid}`);
    const data: User = { 
      userId: user.uid,
      email: user.email ? user.email : '', 
      name: user.displayName.split(" ")[0] ? user.displayName.split(" ")[0] : '',
      phone: user.phoneNumber ? user.phoneNumber : '',
      lastName: user.displayName.split(" ")[1] ? user.displayName.split(" ")[1] : ''
    }
    return userRef.set(data, { merge: true })
  }
}
