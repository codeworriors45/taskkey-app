import { Component, OnInit } from '@angular/core';
import { FirebaseProjectService } from '../../services/firebaseProject.service';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { ActivitylogsService } from '../../services/activitylogs.service';
import { ACTION_MAPPER, ACTION_TITLE_MAPPER } from '../../interfaces/activity.action'
import { ACTIVITY_IDENTIFIER } from '../../interfaces/activity.identifiers'

@Component({
  selector: 'app-archive-card',
  templateUrl: './archive-card.component.html',
  styleUrls: ['./archive-card.component.scss']
})
export class ArchiveCardComponent implements OnInit {
  public projectId
  public userId
  constructor(
    private firebaseProjectService: FirebaseProjectService,
    private bsModalRef: BsModalRef,
    private activitylogsService: ActivitylogsService
  ) { }

  ngOnInit(): void {
  }

  doArchive() {
    this.firebaseProjectService.updateProject({ completed: true }, this.projectId).subscribe(res => {
      this.bsModalRef.hide();
      this.activitylogsService.saveActivtyLogs(this.projectId, ACTION_MAPPER.ARCHIVED, ACTIVITY_IDENTIFIER.CARD_ARCHIVED, this.userId, ACTION_TITLE_MAPPER.archived, 13).subscribe(res => {})
    })
  }

  cancelArchive() {
    this.bsModalRef.hide();
  }

}
