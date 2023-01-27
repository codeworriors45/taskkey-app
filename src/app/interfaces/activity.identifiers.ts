export enum ACTIVITY_IDENTIFIER {
    CARD_CREATED = 1, // tested
    CARD_RENAMED = 2, // tested
    CARD_CHANGED_DESCRIPTION = 3, // tested
    CARD_ARCHIVED = 4, // tested
    CARD_USER_INVITED = 5, // tested
    CARD_USER_REMOVED = 6, // tested
    CARD_USER_ACCEPTED = 7, // tested
    CARD_USER_DECLINED = 8, // tested
    CARD_USER_LEFT = 9, 
    CARD_ADMIN_ADDED = 10, // tested
    CARD_ADMIN_REMOVED = 11, // tested


    TASK_CREATED = 12, // tested
    TASK_COMPLETED = 13, // tested
    TASK_INCOMPLETED = 14, // tested
    TASK_RENAMED = 15, // tested
    TASK_DELETED = 16, // tested
    TASK_REQUEST_UPDATE = 17, // tested
    TASK_STARTED = 18, // tested


    NOTE_CREATED = 19,
    NOTE_RENAMED = 20, 
    NOTE_DELETED = 21,


    FILE_UPLOADED = 22,
    FILE_MULTIPLE_UPLOADED = 23,
    FILE_RENAMED = 24,
    FILE_DELETED = 25,
    

    NONE = -1
}