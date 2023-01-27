import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { ModalModule } from 'ngx-bootstrap/modal';
import { ButtonsModule } from 'ngx-bootstrap/buttons';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CarouselModule } from 'ngx-bootstrap/carousel';

import { LayoutRoutingModule } from './layout-routing.module';
import { LayoutComponent } from './layout.component';
import { HeaderComponent } from './header/header.component';
import { SideMenuComponent } from './side-menu/side-menu.component';
import { ArchiveComponent } from '../archive/archive.component';
import { SettingsComponent } from '../settings/settings.component';
import { ChatBoxComponent } from './chat-box/chat-box.component';
import { NotificationComponent } from './notification-popup/notification.component';
import { CreateCardComponent } from './../dashboard/create-card/create-card.component';
import { SharedModule } from '../shared/shared.module';
import { PickerModule } from '@ctrl/ngx-emoji-mart';

@NgModule({
  declarations: [
    LayoutComponent,
    HeaderComponent,
    SideMenuComponent,
    ArchiveComponent,
    SettingsComponent,
    ChatBoxComponent,
    NotificationComponent,
    CreateCardComponent
  ],
  imports: [
    CommonModule,
    LayoutRoutingModule,
    BsDropdownModule.forRoot(),
    ModalModule.forRoot(),
    ButtonsModule.forRoot(),
    FormsModule,
    CarouselModule.forRoot(),
    TooltipModule.forRoot(),
    ReactiveFormsModule,
    SharedModule,
    PickerModule
  ],
  entryComponents: []
})
export class LayoutModule { }
