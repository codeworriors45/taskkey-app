import { Component, OnInit, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/auth';
import { Store } from '@ngxs/store';
//import { Subscription } from 'rxjs';
// import firebase from 'firebase/app';

import { ClearHomeData } from 'src/app/stateManagement/cards/cards.action';
import { FirebaseProjectService } from 'src/app/services/firebaseProject.service';
import { FirebaseUserService } from 'src/app/services/firebaseUser.service';
import { DeviceDetectorService } from 'ngx-device-detector';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {
  projectRefreshed: boolean = false;
  deviceInfo: any


  constructor(
    private router: Router,
    private afAuth: AngularFireAuth,
    private store: Store,
    private firebaseUserService: FirebaseUserService,
    private firebaseProjectService: FirebaseProjectService,
    private deviceService: DeviceDetectorService
  ) {
    //console.clear()
    if(this.deviceService.isMobile()) {
      this.afAuth.signOut()
      this.router.navigateByUrl('/no-desktop');
    }
    window.localStorage.getItem('tempKey');

    this.afAuth.onAuthStateChanged(async (user) => {
      if (!user) {
        if(!(this.deviceService.isMobile()) && this.router.url.indexOf('auth/login') === -1) {
          this.router.navigateByUrl('/auth/login');
        }
        console.log('logged out!!!!!');
        //reset state to default value
        this.store.dispatch(new ClearHomeData());
      } else {
        //do not do anything;
        console.log('logged in!!!!!');
        const subscription = this.firebaseUserService.getCurrentUser()
        .subscribe(userData => {
          subscription.unsubscribe();
          const user = userData;
          //console.log(user.userId)
          if(user && !user.loggedIn) {
            try {
              const subs = this.firebaseUserService.setLoggedInState(true).subscribe(() => {
                subs.unsubscribe();
              });
            } catch(e) {
              console.log(e)
            }
          }
          
          if(user && user.publicKey) {
            //console.log('onAuthStateChanged(evt) => firebaseProjectService.loadAllUserData()')
            this.firebaseProjectService.loadAllUserData();
          } else {
            this.store.dispatch(new ClearHomeData());
          }
        }, error => {
          subscription.unsubscribe();
          this.store.dispatch(new ClearHomeData());
          console.log("Error: => getCurrentUser", error);
        });
      }
    })
  }

  /*@HostListener("window:beforeunload", ["$event"]) unloadHandler(event: Event) {
    window.localStorage.setItem('tempKey', '00')
  }*/

  /*@HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    console.log('++++++++++  BKS  ++++++++++++++')
    console.log(event);
  }*/

  /*@HostListener('mousemove', ['$event'])
  onMousemove(event: MouseEvent): void  { 
    const y = event.clientY;
    window.localStorage.setItem('clcik', JSON.stringify(y))
  }*/

  ngOnInit() {
    //document.addEventListener('contextmenu', event => event.preventDefault());
    /*window.addEventListener("keydown", (e) => {
      window.localStorage.setItem('keydownnew', JSON.stringify(e.key))
    });*/
    /*window.addEventListener('beforeunload', (e) => {
      window.localStorage.setItem('tempKey', JSON.stringify(e))
      //debugger
      
      //e.preventDefault();
      //var confirmationMessage = 'o/';

      //(e || window.event).returnValue = confirmationMessage; //Gecko + IE
      //return confirmationMessage; //Webkit, Safari, Chrome

      //return confirm("Press a button!"); 
    });*/
  }
}
