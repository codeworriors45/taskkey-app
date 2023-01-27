import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LayoutComponent } from './layout.component';
import { ArchiveComponent } from '../archive/archive.component';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [{ 
      path: '',
      redirectTo: 'dashboard'
    }, {
      path: 'dashboard',
      //component: DashboardComponent,
      loadChildren: () => import('../dashboard/dashboard.module').then( m => m.DashkboardModule)
    }, {
      path: 'archive',
      component: ArchiveComponent,
    }, {
      path: 'bookmarks',
      component: ArchiveComponent,
    }, {
      path: 'invite',
      component: ArchiveComponent,
    }, {
      path: 'planner',
      loadChildren: () => import('../task-planner/task-planner.module').then( m => m.TaskPlannerModule)
    }]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LayoutRoutingModule { }
