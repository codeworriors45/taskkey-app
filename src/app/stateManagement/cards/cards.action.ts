
export class GetAllCards {
    public static readonly type = '[Cards] Get All cards';
}

export class SetAllCards {
    public static readonly type = '[Cards] Set All Cards';
    constructor(public payload: any[]) {}
}

export class SetFileStats {
    public static readonly type = '[File Stats] Set File Stats';
    constructor(public fileStats: any) {}
}

export class GetCard {
    public static readonly type = '[Cards] Get Card';
    constructor(public payload: string) {}
}

export class GetAllOnce {
    public static readonly type = '[Cards] GetAllOnce';
}

export class GetAllTasks {
    public static readonly type = '[Tasks] Get All';
}

export class SetAllTasks {
    public static readonly type = '[Tasks] Set All';
    constructor(public payload: any[]) {}
}
export class UpdateProjectTasks {
    public static readonly type = '[Tasks] Update Project Tasks';
    constructor(public payload: any[], public projectId: string) {}
}
export class SetProjectDueDates {
    public static readonly type = '[All Cards] Set Due Date';
    constructor() {}
}
export class SetHomeDataLoaded {
    public static readonly type = '[Home Data] Loaded';
    constructor() {}
}
export class ClearHomeData {
    public static readonly type = '[Home Data] Clear';
    constructor() {}
}

export class SetSelectedProjectAllParticipants {
    public static readonly type = '[SelectedProject] Set All Participants';
    constructor(public participants: any[]) {}
}

export class DeleteTask {
    public static readonly type = '[Task] Detete Task';
    constructor(public taskId: any) {}
}

export class SetSelectedProjectAllNotes {
    public static readonly type = '[SelectedProject] Set All Notes';
    constructor(public notes: any[]) {}
}

export class DeleteNote {
    public static readonly type = '[Note] Detete Note';
    constructor(public noteId: any) {}
}
