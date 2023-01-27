import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './shared/auth.guard';
import { NodesktopGuard } from './shared/nodesktop.guard';
import { NoDesktopComponent } from './no-desktop/no-desktop.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'app',
    pathMatch: 'full'
  },
  {
    path: 'app',
    canActivate: [AuthGuard],
    loadChildren: () => import('./layout/layout.module').then( m => m.LayoutModule)
  },
  {
    path: 'auth',
    canActivate: [NodesktopGuard],
    loadChildren: () => import('./auth/auth.module').then( m => m.AuthModule)
  },
  { path: 'no-desktop', component: NoDesktopComponent }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  //imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }