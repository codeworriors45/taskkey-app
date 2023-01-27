export enum TIMELINE_IDENTIFIER {
    TASK_CREATE = 1, // {username} Created this task
    TASK_RENAME = 2, // {username} renamed the task {name[0]} to {name[1]}
    TASK_DESC_CHANGE = 3, // {username} changed the task description {name[0]} to {name[1]}
    TASK_STARTED = 4, // {username} started this task
    TASK_COMPLETE = 5, // {username} marked this task complete
    TASK_IN_COMPLETE = 6, // {username} marked this task incomplete
    TASK_REQUEST_UPDATE = 7, // {username} requests updates for this task
    TASK_MEMBER_ASSIGN = 8, // {username} assigned {name} (replace userid to username)
    TASK_MEMBER_UNASSIGN = 9, // {username} unassigned {name} (replace userid to username)
    // Due Date
    TASK_OVERDUE = 10, // {username} changed the due date from {name[0]} to {name[1]}
    TASK_DUE_DATE_CHANGE = 11, // {username} changed the due date from {name[0]} to {name[1]}
    // To-Do
    TODO_ADD = 12, // {username} added {name}
    TODO_ADD_MULTIPLE = 13, // {username} added {name}
    TODO_COMPLETE = 14, // {username} marked {name} complete
    TODO_IN_COMPLETE = 15, // {username} marked {name} incomplete
    TODO_CHANGED = 16, // {username} changed {name[0]} to {name[1]}
    TODO_REMOVE = 17, // {username} removed {name}
    NONE = -1, // {username} {name}
}