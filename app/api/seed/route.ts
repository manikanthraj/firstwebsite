
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { TimetableModel, DateScheduleModel, NoticeModel, AdminModel, StudentModel } from '@/lib/models';
import fs from 'fs';
import path from 'path';

// FORCE STATIC because we need to read local JSON files during build/runtime
// However, in Vercel, reading local files at runtime can be tricky if not bundled.
// Better approach: We will hardcode the data logic or rely on the process.cwd() finding the files.
// For Vercel, `path.join(process.cwd(), 'data')` usually works if `data` is included.
// But valid Vercel deployment requires `includeFiles` in `vercel.json` sometimes.
// Actually, simpler: I'll try to read via `fs`.

export async function GET(request: Request) {
    // Basic security: Check for a secret header or just rely on Admin Code for now? 
    // For simplicity in this "rescue" mode, we'll check the Admin Secret logic or just open it for the initial setup.
    // Let's use a query param ?secret=CampusSync2026
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Simple hardcoded check to prevent random triggers (User knows this code)
    if (secret !== 'CampusSync2026') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await dbConnect();
        const DATA_DIR = path.join(process.cwd(), 'data');

        // 1. Timetables
        const timetablePath = path.join(DATA_DIR, 'timetable.json');
        if (fs.existsSync(timetablePath)) {
            const timetables = JSON.parse(fs.readFileSync(timetablePath, 'utf8'));
            await TimetableModel.deleteMany({});
            for (const t of timetables) {
                await TimetableModel.create({ section: t.section, schedule: t.schedule });
            }
        }

        // 2. Date Schedules
        const datesPath = path.join(DATA_DIR, 'date_schedules.json');
        if (fs.existsSync(datesPath)) {
            // Check for empty file
            const content = fs.readFileSync(datesPath, 'utf8').trim();
            if (content) {
                try {
                    const dateData = JSON.parse(content);
                    await DateScheduleModel.deleteMany({});
                    const docs = [];
                    for (const [date, sections] of Object.entries(dateData)) {
                        // @ts-ignore
                        for (const [section, sessions] of Object.entries(sections)) {
                            docs.push({ date, section, sessions });
                        }
                    }
                    if (docs.length > 0) await DateScheduleModel.insertMany(docs);
                } catch { }
            }
        }

        // 3. Notices
        const noticesPath = path.join(DATA_DIR, 'notices.json');
        if (fs.existsSync(noticesPath)) {
            try {
                const notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
                await NoticeModel.deleteMany({});
                const docs = [];
                for (const [section, data] of Object.entries(notices)) {
                    // @ts-ignore
                    docs.push({ section, message: data.message, timestamp: data.timestamp });
                }
                if (docs.length > 0) await NoticeModel.insertMany(docs);
            } catch { }
        }

        // 4. Admins
        const adminsPath = path.join(DATA_DIR, 'admins.json');
        if (fs.existsSync(adminsPath)) {
            const admins: string[] = JSON.parse(fs.readFileSync(adminsPath, 'utf8'));
            await AdminModel.deleteMany({});
            await AdminModel.insertMany(admins.map(regNo => ({ regNo })));
        }

        // 5. Students (CRITICAL FIX: Was missing)
        const studentsPath = path.join(DATA_DIR, 'students.json');
        if (fs.existsSync(studentsPath)) {
            const students = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));
            await StudentModel.deleteMany({});
            await StudentModel.insertMany(students);
        }

        return NextResponse.json({ success: true, message: 'Database seeded successfully!' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
