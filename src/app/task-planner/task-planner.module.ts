import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { ModalModule } from 'ngx-bootstrap/modal';
import { ButtonsModule } from 'ngx-bootstrap/buttons';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';

import { TaskPlannerRoutingModule } from './task-planner-routing.module';
import { TaskPlannerComponent } from './task-planner.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [
    TaskPlannerComponent,
  ],
  imports: [
    CommonModule,
    TaskPlannerRoutingModule,
    BsDropdownModule.forRoot(),
    ModalModule.forRoot(),
    ButtonsModule.forRoot(),
    FormsModule,
    BsDatepickerModule.forRoot(),
    ReactiveFormsModule,
    SharedModule
  ],
  entryComponents: []
})
export class TaskPlannerModule { }
