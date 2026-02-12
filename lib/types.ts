export interface Student {
    regNo: string;
    name: string;
    section: string;
}

export interface TimeSlot {
    start: string;
    end: string;
}

export interface ClassSession {
    subject: string;
    time: TimeSlot;
    faculty: string;
    isCancelled?: boolean;
}

export interface Notice {
    section: string;
    message: string;
    timestamp: number;
}

export interface Timetable {
    section: string;
    schedule: {
        [day: string]: ClassSession[]; // MON, TUE, etc.
    };
}

export interface DateSchedule {
    [date: string]: { // "YYYY-MM-DD"
        [section: string]: ClassSession[];
    };
}
