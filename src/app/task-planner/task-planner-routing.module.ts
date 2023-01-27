import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TaskPlannerComponent } from './task-planner.component';

const routes: Routes = [
  {
    path: '',
    component: TaskPlannerComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TaskPlannerRoutingModule { }
