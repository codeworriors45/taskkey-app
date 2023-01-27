import { Injectable, EventEmitter } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppEventService {
    public toogleSideMenuEmitter: EventEmitter<any> = new EventEmitter<any>();
    public toogledSideMenuEmitter: EventEmitter<SideMenuState> = new EventEmitter<SideMenuState>();
    public toogleNoNewCardViewEmitter: EventEmitter<NoNewCardView> = new EventEmitter<NoNewCardView>();
    public openCreateCardPopup: EventEmitter<any> = new EventEmitter<any>();
    public onClickCardFilter: EventEmitter<CardFilter> = new EventEmitter<CardFilter>();
    public filterTaskEmiiter: EventEmitter<any> = new EventEmitter<any>();
    public openChatBoxEmitter: EventEmitter<boolean> = new EventEmitter<boolean>();
    public showNotificationView: EventEmitter<NotificationState> = new EventEmitter<NotificationState>();
    public closeCreateCardEmitter: EventEmitter<any> = new EventEmitter<any>();
    public manuallyTriggerFilterOptionBtnClickEvent: EventEmitter<any> = new EventEmitter<any>()

    constructor(
        
    ) { }

    toogleSideMenu() {
        this.toogleSideMenuEmitter.next();
    }

    toogleNoNewCardView(value, type) {
        this.toogleNoNewCardViewEmitter.next({show: value, filterType: type});
    }

    sendTaskFilterString(filterString) {
        this.filterTaskEmiiter.next(filterString)
    }

    toggleChatBoxView(viewChatBox) {
        this.openChatBoxEmitter.next(viewChatBox)
    }

    toggleNotificationBoxView(notificationState) {
        this.showNotificationView.next(notificationState)
    }

}

export interface SideMenuState {
    menuClosed: boolean
}

export interface NoNewCardView {
    show: boolean,
    filterType: string
}

export interface CardFilter {
    value: string
}

export interface NotificationState {
    isOpen: boolean,
    count: number
}
