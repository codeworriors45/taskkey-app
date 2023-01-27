import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { ModalModule } from 'ngx-bootstrap/modal';
import { ButtonsModule } from 'ngx-bootstrap/buttons';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CarouselModule } from 'ngx-bootstrap/carousel';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { PdfViewerModule } from 'ng2-pdf-viewer';

import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { HomeComponent } from './home/home.component';
import { CardDetailComponent } from './card-detail/card-detail.component';
import { TasksComponent } from './components/tasks/tasks.component';
import { DndDirective } from './dnd.directive';
import { FilesComponent } from './components/files/files.component';
//import { CreateCardComponent } from './create-card/create-card.component';
import { SharedModule } from '../shared/shared.module';
import { NotesComponent } from './components/notes/notes.component';
import { ArchiveCardComponent } from './archive-card/archive-card.component';

@NgModule({
  declarations: [
    DashboardComponent,
    HomeComponent,
    CardDetailComponent,
    TasksComponent,
    NotesComponent,
    DndDirective,
    FilesComponent,
    //CreateCardComponent,
    ArchiveCardComponent
  ],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    BsDropdownModule.forRoot(),
    ModalModule.forRoot(),
    ButtonsModule.forRoot(),
    TooltipModule.forRoot(),
    FormsModule,
    CarouselModule.forRoot(),
    BsDatepickerModule.forRoot(),
    PdfViewerModule,
    ReactiveFormsModule,
    SharedModule
  ],
  schemas: [ CUSTOM_ELEMENTS_SCHEMA ],
  entryComponents: []
})
export class DashkboardModule { }
