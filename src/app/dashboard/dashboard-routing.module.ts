import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DashboardComponent } from './dashboard.component';
import { HomeComponent } from './home/home.component';
import { CardDetailComponent } from './card-detail/card-detail.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [{ 
      path: '',
      redirectTo: 'home'
    }, {
      path: 'home',
      component: HomeComponent,
    }, {
      path: 'c/:projectId',
      component: CardDetailComponent,
    }, {
      path: 'c/:projectId/t/:taskId',
      component: CardDetailComponent,
    }]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }
