'use server';

import dbConnect from '@/lib/db';
import { Student, Timetable, ClassSession, DateSchedule } from '@/lib/types';
import { TimetableModel, DateScheduleModel, NoticeModel, AdminModel, StudentModel } from '@/lib/models';
import path from 'path'; // Still needed for data path in logic if any
import fs from 'fs'; // Still needed for admin config

// Keep local file for read-only static config if needed, or minimal fallback.
// But primarily use DB.

export async function login(regNo: string): Promise<{ success: boolean; student?: Student; error?: string }> {
    try {
        await dbConnect();
        // Check local JSON first for initial student logins if DB failed? 
        // Or just migrate students. For now, let's assume valid migration.
        // Actually, we didn't migrate students in the seed script yet? 
        // Checking seed script... Yes we did (Step 5).

        const student = await StudentModel.findOne({ regNo }).lean();

        if (student) {
            // Convert _id to string or remove it to match type
            const { _id, ...rest } = student as any;
            return { success: true, student: rest as Student };
        } else {
            return { success: false, error: 'Registration number not found.' };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: 'Internal server error.' };
    }
}

export async function getTimetable(section: string): Promise<Timetable | null> {
    try {
        await dbConnect();
        const tt = await TimetableModel.findOne({ section }).lean();
        if (!tt) return null;

        // Transform Map to object if needed, Mongoose "lean" might return object
        // The schema defined schedule as Map.
        // We need to return structure matching Timetable interface:
        // interface Timetable { section: string; schedule: { [key: string]: ClassSession[] } }

        // Mongoose Map in lean returns a plain object usually? verifying.
        // If it's a Map, Object.fromEntries.
        // Let's safely cast. 
        // @ts-ignore
        return { section: tt.section, schedule: tt.schedule };
    } catch (error) {
        console.error('GetTimetable error:', error);
        return null;
    }
}

// --- Admin Actions ---

async function getAdminsListFromDB(): Promise<string[]> {
    await dbConnect();
    const admins = await AdminModel.find({}).lean();
    return admins.map((a: any) => a.regNo);
}

// Keep using local config for the SECRET CODE as it is not in valid DB schema
// Or create a Config collection?
// For now, allow local file read for verifyAdminCode (it's safe and static).
export async function verifyAdminCode(code: string): Promise<boolean> {
    const filePath = path.join(process.cwd(), 'data', 'admin_config.json');
    if (!fs.existsSync(filePath)) return false;
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const config = JSON.parse(content);
        return config.secretCode === code;
    } catch {
        return false;
    }
}

export async function verifyAdmin(regNo: string): Promise<boolean> {
    try {
        await dbConnect();
        const admin = await AdminModel.findOne({ regNo });
        return !!admin;
    } catch {
        return false;
    }
}

export async function addAdmin(requesterRegNo: string, newAdminRegNo: string): Promise<{ success: boolean; error?: string }> {
    if (!(await verifyAdmin(requesterRegNo))) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        await dbConnect();
        const exists = await AdminModel.findOne({ regNo: newAdminRegNo });
        if (exists) {
            return { success: false, error: 'User is already an admin' };
        }
        await AdminModel.create({ regNo: newAdminRegNo });
        return { success: true };
    } catch (e) {
        return { success: false, error: 'Database error' };
    }
}

export async function getAdmins(requesterRegNo: string): Promise<string[]> {
    if (!(await verifyAdmin(requesterRegNo))) return [];
    return await getAdminsListFromDB();
}


// Check for notices
export async function getSectionNotice(section: string): Promise<string | null> {
    try {
        await dbConnect();
        const notice = await NoticeModel.findOne({ section }).lean();
        if (!notice) return null;

        // Expire after 24 hours
        // @ts-ignore
        if (Date.now() - notice.timestamp > 86400000) return null;

        // @ts-ignore
        return notice.message;
    } catch {
        return null;
    }
}

export async function updateSectionNotice(requesterRegNo: string, section: string, message: string): Promise<{ success: boolean }> {
    if (!(await verifyAdmin(requesterRegNo))) return { success: false };

    try {
        await dbConnect();
        if (message.trim() === '') {
            await NoticeModel.deleteOne({ section });
        } else {
            await NoticeModel.findOneAndUpdate(
                { section },
                { message, timestamp: Date.now() },
                { upsert: true }
            );
        }
        return { success: true };
    } catch {
        return { success: false };
    }
}

export async function getAllSections(): Promise<string[]> {
    try {
        await dbConnect();
        const timetables = await TimetableModel.find({}, 'section').lean();
        return timetables.map((t: any) => t.section).sort();
    } catch {
        return [];
    }
}

// --- Date Specific Logic ---

function getDayOfWeek(dateString: string): string {
    const date = new Date(dateString);
    const day = date.getDay();
    const map = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return map[day];
}

export async function getScheduleForDate(section: string, date: string): Promise<ClassSession[]> {
    try {
        await dbConnect();
        // 1. Check Date Specific Overrides
        const override = await DateScheduleModel.findOne({ date, section }).lean();
        if (override) {
            // @ts-ignore
            return override.sessions;
        }

        // 2. Fallback to Timetable (Weekly)
        const day = getDayOfWeek(date);
        const tt = await getTimetable(section);
        if (tt && tt.schedule[day]) {
            return tt.schedule[day];
        }

        return [];
    } catch (error) {
        console.error('GetScheduleForDate error:', error);
        return [];
    }
}

// Helper: Ensure date override exists (copy from weekly if needed) and return doc
async function ensureDateOverride(section: string, date: string) {
    let override = await DateScheduleModel.findOne({ date, section });
    if (!override) {
        // Copy from base
        const day = getDayOfWeek(date);
        const tt = await getTimetable(section);
        const baseSessions = tt && tt.schedule[day] ? tt.schedule[day] : [];

        override = await DateScheduleModel.create({
            date,
            section,
            sessions: baseSessions
        });
    }
    return override;
}

export async function updateClassSession(
    requesterRegNo: string,
    section: string,
    dayOrDate: string,
    slotIndex: number,
    newSession: ClassSession,
    isDateSpecific: boolean = false
): Promise<{ success: boolean; error?: string }> {
    if (!(await verifyAdmin(requesterRegNo))) return { success: false, error: 'Unauthorized' };

    try {
        await dbConnect();
        if (isDateSpecific) {
            // Update DateSchedule
            const override = await ensureDateOverride(section, dayOrDate);
            if (slotIndex >= 0 && slotIndex < override.sessions.length) {
                override.sessions[slotIndex] = newSession;
                await override.save();
                return { success: true };
            }
            return { success: false, error: 'Invalid slot' };
        } else {
            // Update Weekly Timetable
            // We need to use $set with array index which is tricky if we don't fetch first.
            // Fetch, modify, save is safer for complex nested arrays.
            const tt = await TimetableModel.findOne({ section });
            if (!tt) return { success: false, error: 'Section not found' };

            // Map access in Mongoose Document: get()
            const scheduleMap = tt.schedule;
            // Depending on Schema type (Map vs Object), access differs. 
            // Schema was Map.
            // In Mongoose document, Map is a Map.
            let daySchedule = scheduleMap.get(dayOrDate);
            if (!daySchedule) daySchedule = [];

            if (slotIndex >= 0 && slotIndex < daySchedule.length) {
                daySchedule[slotIndex] = newSession;
                scheduleMap.set(dayOrDate, daySchedule); // Trigger change tracking
                await tt.save();
                return { success: true };
            }
            return { success: false, error: 'Invalid slot' };
        }
    } catch (e) {
        console.error(e);
        return { success: false, error: 'Update failed' };
    }
}

export async function addClassSession(
    requesterRegNo: string,
    section: string,
    dayOrDate: string,
    newSession: ClassSession,
    isDateSpecific: boolean = false
): Promise<{ success: boolean; error?: string }> {
    if (!(await verifyAdmin(requesterRegNo))) return { success: false, error: 'Unauthorized' };

    try {
        await dbConnect();
        if (isDateSpecific) {
            const override = await ensureDateOverride(section, dayOrDate);
            override.sessions.push(newSession);
            override.sessions.sort((a: ClassSession, b: ClassSession) => a.time.start.localeCompare(b.time.start));
            await override.save();
            return { success: true };
        } else {
            const tt = await TimetableModel.findOne({ section });
            if (!tt) return { success: false, error: 'Section not found' };

            const scheduleMap = tt.schedule;
            let daySchedule = scheduleMap.get(dayOrDate) || [];
            daySchedule.push(newSession);
            daySchedule.sort((a: ClassSession, b: ClassSession) => a.time.start.localeCompare(b.time.start));

            scheduleMap.set(dayOrDate, daySchedule);
            await tt.save();
            return { success: true };
        }
    } catch (e) {
        return { success: false, error: 'Add failed' };
    }
}

export async function deleteClassSession(
    requesterRegNo: string,
    section: string,
    dayOrDate: string,
    slotIndex: number,
    isDateSpecific: boolean = false
): Promise<{ success: boolean; error?: string }> {
    if (!(await verifyAdmin(requesterRegNo))) return { success: false, error: 'Unauthorized' };

    try {
        await dbConnect();
        if (isDateSpecific) {
            const override = await ensureDateOverride(section, dayOrDate); // Ensure it exists before deleting from it
            if (slotIndex >= 0 && slotIndex < override.sessions.length) {
                override.sessions.splice(slotIndex, 1);
                await override.save();
                return { success: true };
            }
            return { success: false, error: 'Invalid slot' };
        } else {
            const tt = await TimetableModel.findOne({ section });
            if (!tt) return { success: false, error: 'Section not found' };

            const scheduleMap = tt.schedule;
            let daySchedule = scheduleMap.get(dayOrDate);
            if (!daySchedule) return { success: false, error: 'Day not found' };

            if (slotIndex >= 0 && slotIndex < daySchedule.length) {
                daySchedule.splice(slotIndex, 1);
                scheduleMap.set(dayOrDate, daySchedule);
                await tt.save();
                return { success: true };
            }
            return { success: false, error: 'Invalid slot' };
        }
    } catch {
        return { success: false, error: 'Delete failed' };
    }
}
