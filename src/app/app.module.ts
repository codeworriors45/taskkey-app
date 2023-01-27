import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { AngularFireModule } from '@angular/fire';
import { NgxsModule } from '@ngxs/store';
import { NgxsFirestoreModule } from '@ngxs-labs/firestore-plugin';
import { NgxsReduxDevtoolsPluginModule } from '@ngxs/devtools-plugin';
import { NgxsLoggerPluginModule } from '@ngxs/logger-plugin';
import { NgxsActionsExecutingModule } from '@ngxs-labs/actions-executing';
//import { AngularFirestoreModule } from '@angular/fire/firestore';
import { environment } from '../environments/environment';

import { CardsState } from './stateManagement/cards/cards.state';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NoDesktopComponent } from './no-desktop/no-desktop.component';

@NgModule({
  declarations: [
    AppComponent,
    NoDesktopComponent
  ],
  entryComponents: [],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    AngularFireModule.initializeApp(environment.firebaseConfig),
    NgxsModule.forRoot([CardsState], {
        developmentMode: !environment.production
    }),
    NgxsLoggerPluginModule.forRoot({
        disabled: environment.production
    }),
    NgxsFirestoreModule.forRoot(),
    NgxsActionsExecutingModule.forRoot(),
    NgxsReduxDevtoolsPluginModule.forRoot({
        name: 'Ngxs Firestore',
        disabled: environment.production,
        actionSanitizer: (action) => ({ ...action, action: null })
    }),
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule
    //AngularFirestoreModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
