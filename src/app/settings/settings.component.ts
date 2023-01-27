import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { FirebaseUserService } from 'src/app/services/firebaseUser.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AngularFireStorage } from "@angular/fire/storage";
import { Observable, Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  public screenSwitchArray: Array<boolean> = Array(5).fill(false)
  public profileForm: FormGroup
  public downloadURL: Observable<string>
  public defaultImage: string = "assets/images/defaultuser.jpg";
  public fbImageUrl: any;
  public user: any;
  public profilePicLoader = false

  constructor(
    private firebaseUserService: FirebaseUserService,
    private profileFormBuilder: FormBuilder,
    private storage: AngularFireStorage,
    public bsModalRef: BsModalRef,
    private modalService: BsModalService,
    public router: Router
  ) { }

  async ngOnInit() {
    this.profileForm = this.profileFormBuilder.group({
      firstName: ['', [Validators.required]],
      lastName: [''],
      email: ['', [Validators.email]],
      phone: [{value: '', disabled: true}]
    })
    await this.getUserDetails()
    this.screenSwitchArray = [true, false, false, false,false]
  }

  ngAfterViewInit() {
    this.modalService.onHide.pipe(takeUntil(this.subscriptionDestroyed$))
    .subscribe(() => {
      const currentUrl = this.router.url;
      const indexOfQuerySaperater = currentUrl.indexOf('?');
      if(indexOfQuerySaperater != -1) {
        this.router.navigateByUrl(currentUrl.slice(0, indexOfQuerySaperater))
      }
    });
  }

  async populateSettingsScreen(event) {
    switch(event.target.id) {
      case "userprofile": 
        this.screenSwitchArray = Array(5).fill(false)
        this.screenSwitchArray[0] = true
        break;
      case "abouttaskkey": 
        this.screenSwitchArray = Array(5).fill(false)
        this.screenSwitchArray[1] = true
        break;
      case "contactus": 
        this.screenSwitchArray = Array(5).fill(false)
        this.screenSwitchArray[1] = true
        window.open("https://www.ibgresearch.ae/contact", "_blank");
        break;
      case "privacypolicy": 
        this.screenSwitchArray = Array(5).fill(false)
        this.screenSwitchArray[1] = true
        window.open("https://www.ibgresearch.ae/privacy-policy", "_blank");
        break;
      case "termsofuse": 
        this.screenSwitchArray = Array(5).fill(false)
        this.screenSwitchArray[1] = true
        window.open("https://www.ibgresearch.ae/terms-and-conditions", "_blank");
        break;
    }
  }

  closePopupAndRemoveParamFromURL() {
    this.bsModalRef.hide();
  }

  getUserDetails() {
    return new Promise((resolve, reject) => {
      this.firebaseUserService.getCurrentUser()
      .pipe(takeUntil(this.subscriptionDestroyed$))
      .subscribe(userData => {
        const user = userData
        if(user) {
          this.profileForm.patchValue({
              firstName: user.name,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone
          })
          this.user = user;
          this.fbImageUrl = user.profileImage
          resolve(null)
        }
      }, error => {
        console.log("Error: Settings => constructor => getCurrentUser", error);
        resolve(null)
      });
    })
    
  }

  saveProfile() {
    const payload = {}
    if (this.profileForm.valid) {
      const formValues = this.profileForm.value;
      payload['profileImage'] = this.fbImageUrl;
      const fName = formValues.firstName ? formValues.firstName.trim() : '';
      const lName = formValues.lastName ? formValues.lastName.trim() : '';
      const nameArr = [fName, lName]
      payload['displayName'] = nameArr.join(' ');
      payload['email'] = formValues.email;
      payload['phoneNumber'] = this.user.phone;
      payload['uid'] = this.user.userId;
      payload['publicKey'] = this.user.publicKey ? this.user.publicKey : '';
      payload['uuid'] = this.user.uuid ? this.user.uuid : '';
      payload['timeStamp'] = this.user.timeStamp ? this.user.timeStamp : new Date();
      this.firebaseUserService.addOrUpdateUserData(payload)
      .pipe(takeUntil(this.subscriptionDestroyed$))
      .subscribe(res => {
        console.log('Profile updated successfully');
        this.bsModalRef.hide();
      }, error => {
        console.log('Error: Settings => updateUserDetails', error);
      })
    } else {
      return false;
    }
  }

  uploadProfilePicture(event) {
    this.profilePicLoader = true
    const file = event.target.files[0];
    const fileName = event.target.files[0].name;
    const filePath = `images/`;
    const fileRef = this.storage.ref(`${filePath}${fileName}`);
    const task = this.storage.upload(`${filePath}${fileName}`, file);
    task
      .snapshotChanges()
      .pipe(takeUntil(this.subscriptionDestroyed$))
      .pipe(
        finalize(() => {
          this.downloadURL = fileRef.getDownloadURL();
          this.downloadURL.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(url => {
            if (url) {
              this.profilePicLoader = false
              this.fbImageUrl = url;
            }
          });
        })
      )
      .subscribe(url => {
        if (url) {
          console.log(url);
        }
      });
  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
  }

}
