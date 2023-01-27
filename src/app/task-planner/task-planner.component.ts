import { Component, OnInit, OnDestroy, ɵɵtrustConstantResourceUrl } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '@ngxs/store';
import * as moment from 'moment';

import { CardsState } from '../stateManagement/cards/cards.state';
import { FirebaseTaskService } from '../services/firebaseTask.service';
import { FirebaseUserService } from '../services/firebaseUser.service';

@Component({
  selector: 'app-task-planner',
  templateUrl: './task-planner.component.html',
  styleUrls: ['./task-planner.component.scss']
})
export class TaskPlannerComponent implements OnInit, OnDestroy {
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  assignedTasksSub: Subscription;
  currentUser: any;
  assignedTasks: any[] = [];
  sortBy = '';
  sortOrder = 1;
  filterOptions = {
    updateRequest: [],
    status: ['pending', 'in-progress', 'overdue'],
    showOnlyToday_sTasks: false,
    hideOverdueTasks: false
  };
  taskCallToAction = [];
  taskStatusArr = [];
  showOnlyToday_sTasks = false;
  hideOverdueTasks = false;
  filterApplied = false;
  filteredTasks: any[] = [];
  eventForm: FormGroup;
  formSubmitted = false;
  currentDate = new Date();
  currentMonthIndex: any;
  fullYear: any;
  //@ViewChild('calenderContent') calenderContent: ElementRef;
  //calenderUIHTML: SafeHtml;
  calenderData: any[] = [];
  selectedDate: any;
  totalTasksNum = 0;
  newTasksNum = 0;
  selectedColumn = -1;
  months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  constructor(
    private router: Router,
    private store: Store,
    private formBuilder: FormBuilder,
    private firebaseTaskService: FirebaseTaskService,
    private firebaseUserService: FirebaseUserService,
  ) {
    this.initForm();    
  }

  ngOnInit(): void {
    const date = new Date();
    this.fullYear = date.getFullYear();
    this.currentMonthIndex = date.getMonth();
    //this.selectedDate = `${date.getDate()}${date.getMonth()}${date.getFullYear()}`;
    //this.selectedColumn = date.getDay();

    const subs = this.firebaseUserService.getCurrentUser().subscribe((userData) => {
      subs.unsubscribe();
      this.currentUser = userData;
      this.getTaskNParticipantsData();
    }, err => {
      subs.unsubscribe();
      console.log(err);
    });
  }

  initForm() {
    this.eventForm = this.formBuilder.group({
      id: new FormControl(''),
      dueDate_DB: new FormControl(null, {
        validators: [Validators.required],
      })
    });
  }

  initCalender(year, month) {
    const firstDate = new Date(year, month, 1);
    const firstDay = firstDate.getDay();
    const calenderViewStartDate = new Date(year, month, (1-firstDay));
    //alert(firstDay);
    
    //debugger
    const lastDate = new Date(year, month + 1, 0);
    //const lastDay = lastDate.getDay();
    const minTotalDaysToShow = firstDay + lastDate.getDate();
    const minWeekToShow = parseInt((minTotalDaysToShow/7).toString())
    const daysLeftToShow = minTotalDaysToShow % 7;
    const numOfWeeksToShow = minWeekToShow + (daysLeftToShow > 0 ? 1 : 0);
    //console.log(numOfWeeksToShow)
    //alert(numOfWeeksToShow);
    this.addTAskEventIfAny(calenderViewStartDate, numOfWeeksToShow)
  }

  goToPreviousMonth() {
    const date = new Date(this.fullYear, this.currentMonthIndex-1, 1);
    this.fullYear = date.getFullYear();
    this.currentMonthIndex = date.getMonth();

    /*const currentDate = new Date();
    if(currentDate.getMonth() == date.getMonth() && date.getFullYear() == currentDate.getFullYear()) {
      this.selectedColumn = currentDate.getDay();
      this.selectedDate = `${currentDate.getDate()}${currentDate.getMonth()}${currentDate.getFullYear()}`;
    } else {
      this.selectedColumn = -1;
      this.selectedDate = `n/a`;
    }*/
    //this.initCalender(this.fullYear, this.currentMonthIndex);
    this.filterTasks();
  }

  goToNextMonth() {
    const date = new Date(this.fullYear, this.currentMonthIndex+1, 1);
    this.fullYear = date.getFullYear();
    this.currentMonthIndex = date.getMonth();
    
    /*const currentDate = new Date();
    if(currentDate.getMonth() == date.getMonth() && date.getFullYear() == currentDate.getFullYear()) {
      this.selectedColumn = currentDate.getDay();
      this.selectedDate = `${currentDate.getDate()}${currentDate.getMonth()}${currentDate.getFullYear()}`;
    } else {
      this.selectedColumn = -1;
      this.selectedDate = `n/a`;
    }*/
    //this.initCalender(this.fullYear, this.currentMonthIndex);
    this.filterTasks();
  }

  goToTodayMonthView() {
    const date = new Date();
    this.fullYear = date.getFullYear();
    this.currentMonthIndex = date.getMonth();
    //this.initCalender(this.fullYear, this.currentMonthIndex);
    this.filterTasks();
    this.selectedDate = `${date.getDate()}${date.getMonth()}${date.getFullYear()}`;
    this.selectedColumn = date.getDay();
    this.showSelectedDateTasksOnly(null);
  }

  addTAskEventIfAny(calenderViewStartDate, numOfWeeksToShow) {
    const numberOfDays = 7;
    let dateToBind = calenderViewStartDate;
    
    let totalTasksNum = 0;
    let newTasksNum = 0;
    let gfg = new Array(numOfWeeksToShow);
    for (var i = 0; i < numOfWeeksToShow; i++) {
      let dataToDisplay = [];
      for(var j = 0; j < numberOfDays; j++) {
        if(dateToBind.getMonth() == this.currentMonthIndex) {
          const data = {
            date: dateToBind,
            dateNum: `${dateToBind.getDate()}${dateToBind.getMonth()}${dateToBind.getFullYear()}`,
            disabled: false,
            column: j,
            tasks: []
          }
          const tasksByDate = this.filteredTasks.filter(task => {
            if(task.dueDate > 0) {
              const dueDateObj = new Date(task.dueDate);
              if (dueDateObj.getDate() == dateToBind.getDate() && dueDateObj.getMonth() == dateToBind.getMonth() && dueDateObj.getFullYear() == dateToBind.getFullYear()) {
                return true;
              } else {
                return false;
              }
            } else {
              return false;
            }
          });
          data.tasks = tasksByDate;
          dataToDisplay.push(data);
        } else {
          const data = {
            date: dateToBind,
            dateNum: 0,
            disabled: true,
            column: j,
            tasks: []
          }
          dataToDisplay.push(data);
        }
        // Update date for next day
        dateToBind = new Date(dateToBind.getFullYear(), dateToBind.getMonth(), dateToBind.getDate() + 1);
      }
      gfg[i] = dataToDisplay;
    }
    this.calenderData = gfg;
    //const selectedMonthDateObj = new Date(this.fullYear, this.currentMonthIndex, 1);
    this.filteredTasks.forEach(task => {
      if(task.dueDate > 0) {
        const dueDateObj = new Date(task.dueDate);
        if (dueDateObj.getMonth() == this.currentMonthIndex && dueDateObj.getFullYear() == this.fullYear) {
          totalTasksNum = totalTasksNum + 1;
          if(!task.readStatus || !task.readStatus[this.currentUser.userId]) {
            newTasksNum = newTasksNum + 1;
          }
        }
      }
    });
    this.totalTasksNum = totalTasksNum;
    this.newTasksNum = newTasksNum;
    //console.log(this.calenderData);
    this.cloneOverDueTasks();
    //this.commentContainers.nativeElement
    //this.data = this.sanitizer.sanitize(res);
        /* OR */
    //this.data = this.sanitizer.bypassSecurityTrustHtml(res);
  }

  setSelectedDate(dataObj) {
    if(dataObj.disabled) {
      return;
    }
    this.selectedDate = `${dataObj.date.getDate()}${dataObj.date.getMonth()}${dataObj.date.getFullYear()}`;
    this.selectedColumn = dataObj.column;
    this.showSelectedDateTasksOnly(dataObj);
  }

  cloneOverDueTasks() {
    const lastDate = new Date(this.fullYear, this.currentMonthIndex + 1, 0);
    const overDueTasks = this.filteredTasks.filter(task => {
      if(task.dueDate) {
        const dueDate_temp = new Date(task.dueDate);
        const taskDueDate = new Date(dueDate_temp.getFullYear(), dueDate_temp.getMonth(), dueDate_temp.getDate());
        if (taskDueDate <= lastDate && task.status == 'overdue') {
          return true;
        }
        return false;
      } else {
        return false;
      }
    });
    if(overDueTasks.length) {
      const date = new Date();
      const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      if(currentDate < lastDate) {
        this.cloneTaskEventUpTo(currentDate, overDueTasks);
      } else {
        this.cloneTaskEventUpTo(lastDate, overDueTasks);
      }
      //console.log('overDueTasks: ', overDueTasks);
    }
    
  }

  cloneTaskEventUpTo(date, overDueTasks) {
    overDueTasks.forEach(task => {
      const dueDate_temp = new Date(task.dueDate);
      const taskDueDate = new Date(dueDate_temp.getFullYear(), dueDate_temp.getMonth(), dueDate_temp.getDate());
      this.calenderData.forEach(row => {
        row.forEach(dayData => {
          const dayDateObj = new Date(dayData.date.getFullYear(), dayData.date.getMonth(), dayData.date.getDate());
          if(!dayData.disabled && dayDateObj >= taskDueDate && dayDateObj <= date) {
            const serchedTask = dayData.tasks.find(t => task.id == t.id);
            if(!serchedTask) {
              dayData.tasks.push(task);
            }
          }
        });
      })
    });
  }

  getTaskNParticipantsData() {
    if(this.assignedTasksSub) {
      this.assignedTasksSub.unsubscribe();
    }
    this.assignedTasksSub = this.firebaseTaskService.getAssignedTask().subscribe((tasks) => {
      const cards$ = this.store.select(
        CardsState.getCards()
      );
      cards$.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((cards) => {
        //const projectIds = this.getUniqueProjectIds(tasks);
        const notCompletedCardTasks = [];
        tasks.forEach(task => {
          const associatedCard = cards.find(c => c.id == task.projectId);
          if(associatedCard) {
            notCompletedCardTasks.push({...task, cardName: associatedCard.name});
          }
        })

        const mappedTasks = notCompletedCardTasks.map((task) => {
          //const createdBy = this.selectedProjectAllParticipants.find((participant) => participant.userId == task.createdBy);
          let dueDate = 0;
          let dueDateToDisplay = '--';
          if(task.dueDate) {
              dueDate = parseInt((task.dueDate.seconds*1000).toString()) + parseInt((task.dueDate.nanoseconds/1000000).toString());
              
              dueDateToDisplay = moment(dueDate).calendar();
              if(dueDateToDisplay.indexOf('/') !== -1) {
                dueDateToDisplay =  moment(dueDate).format("D MMM");
              } else {
                dueDateToDisplay = (dueDateToDisplay.split(" at"))[0];
              }
          }
  
          let inCompleteTodo = 0;
          if(!this.isUndefinedOrNull(task.inCompleteTodo)) {
            inCompleteTodo = task.inCompleteTodo;
          }
  
          const participantsArr = [];
          for (const participantId in task.participants) {
            participantsArr.push(task.participants[participantId]);
          }
  
          const participant = participantsArr.find(p => p.id == this.currentUser.userId);
  
          let unreadMsg = 0;
          if(!this.isUndefinedOrNull(participant.unreadMsg)) {
            unreadMsg = participant.unreadMsg;
          }
  
          let status = 'pending';
          if(task.completed) {
              status =  'completed';
          } else if(dueDate) {
            const dueDate_temp = new Date(dueDate);
            const dueDateObj = new Date(dueDate_temp.getFullYear(), dueDate_temp.getMonth(), dueDate_temp.getDate());
            const currentDate_temp = new Date();
            const currentDate = new Date(currentDate_temp.getFullYear(), currentDate_temp.getMonth(), currentDate_temp.getDate());
            if(currentDate.getTime() > dueDateObj.getTime()) {
              status =  'overdue';
            } else if(task.isStarted) {
              status = 'in-progress';
            }
          } else if(task.isStarted) {
            status = 'in-progress';
          }
  
          let statusForSorting = 0;
          if(task.status == 'pending') {
            statusForSorting = 1;
          }
          if(task.status == 'in-progress') {
            statusForSorting = 2;
          }
          if(task.status == 'overdue') {
            statusForSorting = 3;
          }
          if(task.status == 'completed') {
            statusForSorting = 4;
          }
  
          let miliseconds = 0;
          if (task.timestamp && task.timestamp.seconds) {
            miliseconds = parseInt((task.timestamp.seconds * 1000).toString()) + parseInt((task.timestamp.nanoseconds / 1000000).toString());
          }
          return {...task, _createdBy: '', status, participants: participantsArr, dueDate, statusForSorting, createdAt: miliseconds, unreadMsg, inCompleteTodo, dueDateToDisplay }
        });
        this.assignedTasks = [...mappedTasks];
        this.filterTasks();
        //console.log('------------------ Assigned tasks------------');
        //console.log(this.assignedTasks);
      });      
    });
  }

  getUniqueProjectIds(tasks) {
    const projectIds = [];
    tasks.forEach(task => {
      if(projectIds.indexOf(task.projectId) == -1) {
        projectIds.push(task.projectId);
      }
    });
    return projectIds
  }

  isUndefinedOrNull(value) {
    if(value == undefined || value == null) {
      return true
    }
    return false;
  }

  showSelectedDateTasksOnly(dataObj) {
    //this.selectedDate
    if(dataObj) {
      this.filteredTasks = dataObj.tasks;
    } else {
      //get tasks
      console.log(this.calenderData)
      this.calenderData.forEach(row => {
        row.forEach(dayData => {
          if(dayData.dateNum == this.selectedDate) {
            this.filteredTasks = dayData.tasks;
          }
        });
      })
    }
    
    let sortBy = this.sortBy;
    if(sortBy == '') {
      sortBy = 'dueDate';
    }
    if(sortBy == 'createdBy') {
      sortBy = 'createdAt';
    }

    if(sortBy == 'status') {
      sortBy = 'statusForSorting';
    }

    this.filteredTasks.sort((a,b) => {
      let result = (a[sortBy] < b[sortBy]) ? -1 : (a[sortBy] > b[sortBy]) ? 1 : 0;
      return result * this.sortOrder;
    });
  }

  sortTasks() {
    let sortBy = this.sortBy;
    if(sortBy == '') {
      sortBy = 'dueDate';
    }
    if(sortBy == 'createdBy') {
      sortBy = 'createdAt';
    }

    if(sortBy == 'status') {
      sortBy = 'statusForSorting';
    }

    this.filteredTasks.sort((a,b) => {
      let result = (a[sortBy] < b[sortBy]) ? -1 : (a[sortBy] > b[sortBy]) ? 1 : 0;
      return result * this.sortOrder;
    });
    
    this.initCalender(this.fullYear, this.currentMonthIndex);
  }

  toogleSortOrder() {
    this.sortOrder = -1 * this.sortOrder;
    if(this.sortBy == '') {
      this.sortBy = 'dueDate';
    }
    this.sortTasks();
  }

  preventClose(event: MouseEvent) {
    event.stopImmediatePropagation();
  }

  openFiletrDropDown(filterDropdown) {
    this.taskStatusArr = [...this.filterOptions.status];
    this.taskCallToAction = [...this.filterOptions.updateRequest];
    this.showOnlyToday_sTasks = this.filterOptions.showOnlyToday_sTasks;
    this.hideOverdueTasks = this.filterOptions.hideOverdueTasks;
    filterDropdown.show();
  }

  applyFiletrDropDown() {
    this.filterOptions.status = [...this.taskStatusArr];
    this.filterOptions.updateRequest = [...this.taskCallToAction];
    this.filterOptions.showOnlyToday_sTasks = this.showOnlyToday_sTasks;
    this.filterOptions.hideOverdueTasks = this.hideOverdueTasks;
    //console.log(this.filterOptions)
    this.filterTasks();
    this.filterApplied = true;
  }

  filterTasks() {
    //this.filteredFiles = this.uploadedFiles;
    this.filteredTasks = this.assignedTasks.filter((task) => {
      let showTask = true;
      if(this.filterOptions.showOnlyToday_sTasks || this.filterOptions.hideOverdueTasks) {
        if( this.filterOptions.hideOverdueTasks && task.status == 'overdue') {
          showTask = false;
        }
        if(this.filterOptions.showOnlyToday_sTasks) {
          const dueDate_temp = new Date(task.dueDate);
          const dueDate = new Date(dueDate_temp.getFullYear(), dueDate_temp.getMonth(), dueDate_temp.getDate());
          const currentDate_temp = new Date();
          const currentDate = new Date(currentDate_temp.getFullYear(), currentDate_temp.getMonth(), currentDate_temp.getDate());
          if(currentDate.getTime() != dueDate.getTime()) {
            showTask = false;
          }
        }
      }

      let filteredByUpdateRequest = true;
      if(this.filterOptions.updateRequest.length == 1) {
        const filterby = this.filterOptions.updateRequest[0] == 'active'? true : false;
        if(task.callToAction != filterby) {
          filteredByUpdateRequest = false;
        }
      }

      return (this.filterOptions.status.length > 0 ? this.filterOptions.status.indexOf(task.status) != -1 : true) && showTask  && filteredByUpdateRequest;
    });
    this.selectedColumn = -1;
    this.selectedDate = `n/a`;
    this.sortTasks();
  }

  resetFilterDropDown() {
    this.filterOptions.status = [];
    this.filterOptions.updateRequest = [];
    this.filterOptions.showOnlyToday_sTasks = false;
    this.filterOptions.hideOverdueTasks = false;

    this.taskStatusArr = [];
    
    this.taskCallToAction = [];
    this.showOnlyToday_sTasks = false;
    this.hideOverdueTasks = false;

    this.filteredTasks = this.assignedTasks;
    this.filterApplied = false;
    this.sortTasks();
  }

  toogleSelectedStatusForFilter(status) {
    const index = this.taskStatusArr.indexOf(status);
    if(index == -1) {
      this.taskStatusArr.push(status)
    } else {
      this.taskStatusArr.splice(index, 1);
    }
  }

  toogleSelectedStatus(status) {
    const index = this.filterOptions.status.indexOf(status);
    if(index == -1) {
      this.filterOptions.status.push(status)
    } else {
      this.filterOptions.status.splice(index, 1);
    }
    this.filterTasks();
  }

  toogleUpdateRequestForFilter(value) {
    const index = this.taskCallToAction.indexOf(value);
    if(index == -1) {
      this.taskCallToAction.push(value)
    } else {
      this.taskCallToAction.splice(index, 1);
    }
  }

  openFileOperationDropDown(dropDown) {
    //event.stopPropagation();
    dropDown.show();
  }

  showTaskDetail(task) {
    this.router.navigateByUrl(`app/dashboard/c/${task.projectId}/t/${task.id}`);
  }

  startCreateEvent() {

  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
    if(this.assignedTasksSub) {
      this.assignedTasksSub.unsubscribe();
    }
  }
}
