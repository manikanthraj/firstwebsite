
// scripts/seed_mongo.js
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' }); // Load env vars

// Define simple schemas inline for the script (since we can't easily import TS models in JS script without build)
// Or better, we can just use "raw" updates or define schemas here. 
// Defining simple schemas here to ensure structure.

const TimeSlotSchema = new mongoose.Schema({
    start: String,
    end: String
}, { _id: false });

const ClassSessionSchema = new mongoose.Schema({
    subject: String,
    time: TimeSlotSchema,
    faculty: String,
    isCancelled: { type: Boolean, default: false }
}, { _id: false });

const TimetableSchema = new mongoose.Schema({
    section: { type: String, unique: true },
    schedule: { type: Map, of: [ClassSessionSchema] }
});

const DateScheduleSchema = new mongoose.Schema({
    date: String,
    section: String,
    sessions: [ClassSessionSchema]
});
DateScheduleSchema.index({ date: 1, section: 1 }, { unique: true });

const NoticeSchema = new mongoose.Schema({
    section: { type: String, unique: true },
    message: String,
    timestamp: Number
});

const AdminSchema = new mongoose.Schema({
    regNo: { type: String, unique: true }
});

const StudentSchema = new mongoose.Schema({
    regNo: String,
    password: { type: String, required: true }, // Ensure we map 'password' correctly
    name: String,
    section: String
});

// Models
const TimetableModel = mongoose.models.Timetable || mongoose.model('Timetable', TimetableSchema);
const DateScheduleModel = mongoose.models.DateSchedule || mongoose.model('DateSchedule', DateScheduleSchema);
const NoticeModel = mongoose.models.Notice || mongoose.model('Notice', NoticeSchema);
const AdminModel = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
const StudentModel = mongoose.models.Student || mongoose.model('Student', StudentSchema);


async function seed() {
    if (!process.env.MONGODB_URI) {
        console.error("MONGODB_URI not found in environment variables.");
        process.exit(1);
    }

    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected.");

        const DATA_DIR = path.join(process.cwd(), 'data');

        // 1. Timetables
        const timetablePath = path.join(DATA_DIR, 'timetable.json');
        if (fs.existsSync(timetablePath)) {
            const timetables = JSON.parse(fs.readFileSync(timetablePath, 'utf8'));
            console.log(`Seeding ${timetables.length} timetables...`);
            await TimetableModel.deleteMany({}); // Clear existing
            for (const t of timetables) {
                // Convert object to Map format if needed, but Mongoose Map handles object
                await TimetableModel.create({
                    section: t.section,
                    schedule: t.schedule
                });
            }
            console.log("Timetables seeded.");
        }

        // 2. Date Schedules
        const datesPath = path.join(DATA_DIR, 'date_schedules.json');
        if (fs.existsSync(datesPath)) {
            try {
                const dateData = JSON.parse(fs.readFileSync(datesPath, 'utf8'));
                // dateData structure: { "2025-02-12": { "CA": [sessions] } }
                // Need to flatten to: { date: "2025-02-12", section: "CA", sessions: [...] }
                console.log("Seeding Date Schedules...");
                await DateScheduleModel.deleteMany({});

                const docs = [];
                for (const [date, sections] of Object.entries(dateData)) {
                    for (const [section, sessions] of Object.entries(sections)) {
                        docs.push({ date, section, sessions });
                    }
                }
                if (docs.length > 0) {
                    await DateScheduleModel.insertMany(docs);
                }
                console.log(`Seeded ${docs.length} date overrides.`);
            } catch (e) {
                console.error("Error seeding date schedules (might be empty/corrupt):", e.message);
            }
        }

        // 3. Notices
        const noticesPath = path.join(DATA_DIR, 'notices.json');
        if (fs.existsSync(noticesPath)) {
            try {
                const notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
                // Structure: { "CA": { message: "msg", timestamp: 123 } }
                console.log("Seeding Notices...");
                await NoticeModel.deleteMany({});
                const docs = [];
                for (const [section, data] of Object.entries(notices)) {
                    docs.push({ section, message: data.message, timestamp: data.timestamp });
                }
                if (docs.length > 0) await NoticeModel.insertMany(docs);
            } catch (e) { console.error("Error notices:", e.message); }
        }

        // 4. Admins
        const adminsPath = path.join(DATA_DIR, 'admins.json');
        if (fs.existsSync(adminsPath)) {
            const admins = JSON.parse(fs.readFileSync(adminsPath, 'utf8'));
            console.log(`Seeding ${admins.length} admins...`);
            await AdminModel.deleteMany({});
            await AdminModel.insertMany(admins.map(regNo => ({ regNo })));
        }

        // 5. Students
        const studentsPath = path.join(DATA_DIR, 'students.json');
        if (fs.existsSync(studentsPath)) {
            const students = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));
            console.log(`Seeding ${students.length} students...`);
            await StudentModel.deleteMany({});
            await StudentModel.insertMany(students); // Schema matches JSON fields
        }

        console.log("Migration Complete!");
        process.exit(0);

    } catch (error) {
        console.error("Migration Failed:", error);
        process.exit(1);
    }
}

seed();
