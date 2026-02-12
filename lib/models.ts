
import mongoose, { Schema, model, models } from 'mongoose';

// --- Sub-Schemas ---
const TimeSlotSchema = new Schema({
    start: { type: String, required: true },
    end: { type: String, required: true }
}, { _id: false });

const ClassSessionSchema = new Schema({
    subject: { type: String, required: true },
    time: { type: TimeSlotSchema, required: true },
    faculty: { type: String }, // Optional
    isCancelled: { type: Boolean, default: false }
}, { _id: false });

// --- Main Schemas ---

// 1. Timetable (Weekly Recurring)
// section: "CA"
// schedule: { "MON": [ClassSession], "TUE": ... }
const TimetableSchema = new Schema({
    section: { type: String, required: true, unique: true },
    schedule: {
        type: Map,
        of: [ClassSessionSchema] // Key is Day (MON, TUE), Value is Array of Sessions
    }
});

// 2. DateSchedule (Specific Date Overrides)
// We store one document per date-section combination for efficient lookup
const DateScheduleSchema = new Schema({
    date: { type: String, required: true }, // "YYYY-MM-DD"
    section: { type: String, required: true },
    sessions: [ClassSessionSchema]
});
// Compound index for fast lookup
DateScheduleSchema.index({ date: 1, section: 1 }, { unique: true });

// 3. Notice
const NoticeSchema = new Schema({
    section: { type: String, required: true, unique: true },
    message: { type: String, required: true },
    timestamp: { type: Number, required: true } // For expiration check
});

// 4. Admin
const AdminSchema = new Schema({
    regNo: { type: String, required: true, unique: true }
});

// 5. Student (For future expansion or if we move students.json to DB)
const StudentSchema = new Schema({
    regNo: { type: String, required: true, unique: true },
    password: { type: String }, // Optional for now (RegNo auth)
    name: { type: String },
    section: { type: String }
});


// --- Models ---
// Use `models.ModelName || model(...)` pattern prevents recompilation error in Next.js hot reload
export const TimetableModel = models.Timetable || model('Timetable', TimetableSchema);
export const DateScheduleModel = models.DateSchedule || model('DateSchedule', DateScheduleSchema);
export const NoticeModel = models.Notice || model('Notice', NoticeSchema);
export const AdminModel = models.Admin || model('Admin', AdminSchema);
export const StudentModel = models.Student || model('Student', StudentSchema);
