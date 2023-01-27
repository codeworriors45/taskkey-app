import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, RouterEvent } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

@Component({
  selector: 'app-side-menu',
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.scss']
})
export class SideMenuComponent implements OnInit, OnDestroy {
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  public selectedIndex = 0;
  public appPages = [
    {
      title: 'Dashboard',
      url: 'dashboard',
      icon: 'fa-home'
    },
    {
      title: 'Archive',
      url: 'archive',
      icon: 'fa-archive'
    },
    // {
    //   title: 'Bookmarks',
    //   url: 'bookmarks',
    //   icon: 'fa-envelope'
    // },
    // {
    //   title: 'Invite',
    //   url: 'invite',
    //   icon: 'fa-users'
    // }
  ];

  constructor(
    private router: Router
  ) { 
    //this.setMenuItemSelected();
    this.router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntil(this.subscriptionDestroyed$)).subscribe((endUrl: RouterEvent) => {
      this.setMenuItemSelected();
    });
  }

  ngOnInit(): void {

  }

  ngAfterViewInit() {
    
  }

  setMenuItemSelected() {
    //const path = window.location.pathname;
    const urlPartArr = this.router.url.split('/');
    this.selectedIndex = this.appPages.findIndex((page) => {
      if(page.url) {
        const pageUrlArr = page.url.split('/');
        return pageUrlArr[0] === urlPartArr[2].toLowerCase()
      } else {
        return false;
      }
    });
  }

  onMenuItemClick(menuItem) {
    if(menuItem.url) {
      this.router.navigateByUrl(`/app/${menuItem.url}`);
    } else {
      //Do not do any thing for now
    }
  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
  }

}
