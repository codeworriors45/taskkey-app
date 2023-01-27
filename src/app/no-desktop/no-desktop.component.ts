import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-no-desktop',
  templateUrl: './no-desktop.component.html',
  styleUrls: ['./no-desktop.component.scss']
})
export class NoDesktopComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

  redirectToDynamicLink() {
    window.open("https://taskkeyapp.page.link/share", "_blank");
  }

}
