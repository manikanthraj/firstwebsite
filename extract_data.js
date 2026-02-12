const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const TIMETABLE_FILE = path.join(DATA_DIR, 'timetable.json');

const NOISE_PATTERNS = [
    "MANDATORY LEARNING",
    "COURSE DAY",
    "OFFICE OF",
    "TIMETABLE:",
    "Date:",
    "After completing",
    "considered in lieu",
    "credits which would be",
    "Open Elective",
    "Semester & Section",
    "Coordinator",
    "Director",
    "Dean",
    "Associate",
    "Faculty",
    "Mode",
    "Time",
    "Day",
    "Subject",
    "Room",
    "Block",
    "Campus",
    "CPI",
    "CREATIVITY",
    "Dr.",
    "Ph.D",
    "IPE",
    "problem solving",
    "innovation",
    "ION LAB",
    "LAB DR.",
    "PH1:",
    "PH2:",
    "PF1:",
    "PF2:",
    "PM1:",
    "PM2:"
];

async function extractStudentData() {
    console.log("Extracting Student Data...");
    const files = ['Student_Core.pdf', 'Student_CSE.pdf'];
    let students = [];

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        if (fs.existsSync(filePath)) {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            const text = data.text;

            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

            for (let i = 0; i < lines.length; i++) {
                if (/^\d{12}$/.test(lines[i])) {
                    const regNo = lines[i];
                    const name = lines[i - 1];
                    const sectionLine = lines[i + 1];
                    let section = "";

                    if (sectionLine && /^[A-Z]{2}\d+/.test(sectionLine)) {
                        section = sectionLine.substring(0, 2);
                    } else if (sectionLine && /^[A-Z]{2}/.test(sectionLine)) {
                        section = sectionLine.substring(0, 2);
                    }

                    if (name && section) {
                        students.push({
                            regNo,
                            name,
                            section
                        });
                    }
                }
            }
        }
    }
    console.log(`Extracted ${students.length} students.`);
    fs.writeFileSync(STUDENTS_FILE, JSON.stringify(students, null, 2));
}

async function extractTimetable() {
    console.log("Extracting Timetable...");
    const filePath = path.join(DATA_DIR, 'SEM2_TimeTable.pdf');
    if (!fs.existsSync(filePath)) return;

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const text = data.text;

    const chunks = text.split(/Semester & Section:\s*II SEM\s*/);
    let timetables = [];

    for (let i = 1; i < chunks.length; i++) {
        let chunk = chunks[i];
        const sectionCode = chunk.substring(0, 2);

        if (!chunk.includes("08.00 - 09.00")) {
            continue;
        }

        const schedule = {};
        const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

        for (let d = 0; d < days.length; d++) {
            const currentDay = days[d];
            const nextDay = days[d + 1] || 'MANDATORY LEARNING';

            const dayStart = chunk.indexOf(currentDay);
            if (dayStart === -1) continue;

            let dayEnd = -1;

            if (d < days.length - 1) dayEnd = chunk.indexOf(nextDay, dayStart);
            else {
                const footers = ["MANDATORY LEARNING", "OFFICE OF", "TIMETABLE:", "Course Code", "Course Title", "Cycle :", "Cycle:"];
                let minIdx = chunk.length;
                let found = false;
                for (const footer of footers) {
                    const idx = chunk.indexOf(footer, dayStart);
                    if (idx !== -1 && idx < minIdx) {
                        minIdx = idx;
                        found = true;
                    }
                }
                if (found) dayEnd = minIdx;
                else dayEnd = chunk.length;
            }

            if (dayEnd === -1) {
                for (let k = d + 1; k < days.length; k++) {
                    const nd = days[k];
                    const idx = chunk.indexOf(nd, dayStart);
                    if (idx !== -1) { dayEnd = idx; break; }
                }
            }
            if (dayEnd === -1) dayEnd = chunk.length;

            const dayContent = chunk.substring(dayStart + currentDay.length, dayEnd);
            const rawLines = dayContent.split(/\r?\n/);

            let emptyCount = 0;
            for (const l of rawLines) {
                if (!l.trim()) emptyCount++;
                else break;
            }
            let slotIndex = Math.max(0, emptyCount - 1);

            const timeSlots = [
                { start: "08:00", end: "09:00" },
                { start: "09:00", end: "10:00" },
                { start: "10:30", end: "11:30" },
                { start: "11:30", end: "12:30" },
                { start: "13:00", end: "14:00" },
                { start: "14:00", end: "15:00" },
                { start: "15:30", end: "16:30" }
            ];

            let classes = [];

            for (let r = 0; r < rawLines.length; r++) {
                let line = rawLines[r];
                if (!line) continue;
                line = line.trim();
                if (line.length === 0) continue;

                if (line.includes("MANDATORY LEARNING") || line.includes("OFFICE OF") || line.includes("Course Code")) break;

                if (line.includes("Lunch Break") || line.includes("Lunch")) {
                    // PL Friday Fix: CHEM LAB is on the same line as Lunch Break
                    if (sectionCode === 'PL' && currentDay === 'FRI' && line.includes("CHEM LAB")) {
                        classes.push({
                            subject: "CHEM LAB",
                            time: { start: "09:00", end: "11:30" },
                            faculty: ""
                        });
                    }

                    slotIndex = 4; // Jump to 13:00

                    // CQ Tuesday Fix: If previous class was Workshop ending at 12:00, skip to 14:00
                    // RESTRICTED TO CQ ONLY to avoid breaking CB Monday
                    if (sectionCode === 'CQ' && classes.length > 0) {
                        const last = classes[classes.length - 1];
                        if (last.subject.toUpperCase().includes("WORKSHOP") && last.time && last.time.end === "12:00") {
                            slotIndex = 5;
                        }
                    }
                    continue;
                }
                if (line === "Break") {
                    if (slotIndex <= 2) slotIndex = 2; // Jump to 10:30
                    else if (slotIndex >= 5) slotIndex = 6; // Jump to 15:30
                    continue;
                }

                if (line.length < 2 || line.startsWith('*') || NOISE_PATTERNS.some(p => line.includes(p))) {
                    continue;
                }

                line = line.replace(/\b[A-Z]{3}\s*\d{4}\b/g, "").trim();
                line = line.replace(/\b[A-Z]{3}\s+IV\b/g, "").trim();

                if (line.length < 2) continue;
                if (line.includes(" + ") && line.includes("DR.")) continue;

                if (/^\(.*\)$/.test(line)) {
                    if (classes.length > 0) {
                        const lastClass = classes[classes.length - 1];
                        lastClass.faculty = line;
                    }
                    continue;
                }

                const isLocation = line.startsWith('[') ||
                    line.startsWith('AB') ||
                    line.includes('TEAMS') ||
                    line.startsWith('ROOM');

                if (isLocation) {
                    continue;
                }

                // --- Custom Time Parsing ---
                let customTime = null;
                const timeRangeMatch = line.match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);

                if (timeRangeMatch) {
                    let h1 = parseInt(timeRangeMatch[1]);
                    const m1 = timeRangeMatch[2];
                    let h2 = parseInt(timeRangeMatch[3]);
                    const m2 = timeRangeMatch[4];
                    const isPM = line.toUpperCase().includes("PM");

                    if (isPM && h1 < 12) h1 += 12;
                    else if (!isPM && h1 < 7) h1 += 12;
                    else if (!isPM && h1 === 12) { }

                    if (isPM && h2 < 12) h2 += 12;
                    else if (h2 < 8) h2 += 12;

                    customTime = {
                        start: `${h1.toString().padStart(2, '0')}:${m1}`,
                        end: `${h2.toString().padStart(2, '0')}:${m2}`
                    };
                }

                if (slotIndex < timeSlots.length || customTime) {
                    const subjectUpper = line.toUpperCase();
                    let startStr = customTime ? customTime.start : timeSlots[slotIndex] ? timeSlots[slotIndex].start : "00:00";

                    // --- Heuristic Overrides ---
                    let durationMins = 60;

                    // --- Configuration for Specific Overrides ---
                    const MORNING_OVERRIDES = {
                        "CD": { "WED": [{ match: ["DAV LAB", "DAV"], start: "08:30", end: "11:30" }] },
                        "CE": { "SAT": [{ match: ["DAV LAB", "DAV"], start: "08:30", end: "11:30" }] },
                        "CH": { "TUE": [{ match: ["DAV LAB", "DAV"], start: "08:30", end: "11:30" }] }
                        // PL handled manually above
                    };

                    const AFTERNOON_OVERRIDES = {
                        "CC": { "FRI": ["PHY"] },
                        "CD": { "FRI": ["FME"] },
                        "CE": { "THU": ["PHY"] },
                        "CG": { "SAT": ["FE"] },
                        "CH": { "TUE": ["FE"] },
                        "CK": { "FRI": ["PHY"] },
                        "CL": { "FRI": ["MATHS"] },
                        "CM": { "FRI": ["BE"] },
                        "CN": { "FRI": ["ENG"] },
                        "CR": { "TUE": ["MOS"] },
                        // P-Sections
                        "PA": { "FRI": ["FEE"] },
                        "PB": { "FRI": ["IOOP"] },
                        "PC": { "FRI": ["EMSB"] },
                        "PD": { "FRI": ["IOOP"] },
                        "PG": { "SAT": ["MATHS"] },
                        "PH": { "TUE": ["MATHS"] },
                        "PK": { "FRI": ["PSUC"] },
                        "PL": { "FRI": ["EVS", "EVS (L)"] },
                        "PM": { "FRI": ["BIO"] },
                        "PN": { "FRI": ["EVS", "EVS (L)"] },
                        "PQ": { "THU": ["PSUC"] }
                    };

                    // Apply Morning Overrides
                    if (MORNING_OVERRIDES[sectionCode] && MORNING_OVERRIDES[sectionCode][currentDay]) {
                        const overrides = MORNING_OVERRIDES[sectionCode][currentDay];
                        for (const ov of overrides) {
                            if (ov.match.some(m => subjectUpper.includes(m))) {
                                customTime = { start: ov.start, end: ov.end };
                                durationMins = 0; // Handled by start/end
                                break;
                            }
                        }
                    }

                    // 1. Engineering Graphics (EG/CAEG)
                    if (subjectUpper.includes("EG ") || subjectUpper.includes("EG –") || subjectUpper.includes("CAEG") || subjectUpper.includes("DAV LAB")) {
                        durationMins = 180;
                        if (slotIndex <= 1 && !customTime) {
                            customTime = { start: "08:30", end: "11:30" };
                        } else if (slotIndex === 4 && !customTime) {
                            slotIndex = 5;
                        }
                    }
                    // 2. Workshop
                    else if (subjectUpper.includes("WORKSHOP")) {
                        durationMins = 120; // 2 hours

                        // Slot 0 (08:00) -> 08:00-10:00 (CF Case)
                        // Slot 1 (09:00/occupied 0-1) -> 10:00-12:00

                        // CQ Tue Exception: Workshop acts as 10-12
                        // We check sectionCode if available
                        if (sectionCode === 'CQ' && currentDay === 'TUE' && slotIndex < 2 && !customTime) {
                            customTime = { start: "10:00", end: "12:00" };
                        } else if (slotIndex === 1 && !customTime) {
                            customTime = { start: "10:00", end: "12:00" };
                        }

                        if (slotIndex === 4 && !customTime) slotIndex = 5;
                    }
                    // 3. (P) -> 2 Hours
                    // CF Tue: ENG (P) allowed at 13:00 (Slot 4)
                    else if (subjectUpper.includes("(P)")) {
                        durationMins = 120;
                        // No automatic push to 14:00
                    }
                    // 4. Other Labs -> 2.5/3 Hours
                    // DAV LAB, IOOP LAB, etc -> 2.5 or 3h
                    else if (subjectUpper.includes("LAB") || subjectUpper.includes(" LAB")) {
                        if (subjectUpper.includes("DAV") || subjectUpper.includes("CAEG")) durationMins = 180;
                        else durationMins = 150;

                        // Labs generally start at 14:00 (Slot 5) if in afternoon
                        // Exception: Check if it fits at 13:00? No, usually 14:00-16:30/17:00
                        if (slotIndex === 4 && !customTime) slotIndex = 5;
                    }

                    // 5. Saturday Afternoon Overrides & Specific Fixes
                    // CQ Sat: MOS -> 14:00 (Slot 5)
                    if (sectionCode === 'CQ' && currentDay === 'SAT' && subjectUpper.includes("MOS") && slotIndex === 4 && !customTime) {
                        slotIndex = 5;
                    }

                    // Apply Afternoon Overrides (Force 14:00 / Slot 5)
                    if (AFTERNOON_OVERRIDES[sectionCode] && AFTERNOON_OVERRIDES[sectionCode][currentDay]) {
                        const targets = AFTERNOON_OVERRIDES[sectionCode][currentDay];
                        if (targets.some(t => subjectUpper.includes(t)) && slotIndex === 4 && !customTime) {
                            slotIndex = 5;
                        }
                    }

                    // CA/CB Friday: FME starts at 14:00 (Slot 5), not 13:00
                    if ((sectionCode === 'CA' || sectionCode === 'CB') && currentDay === 'FRI' && subjectUpper.includes("FME") && slotIndex === 4 && !customTime) {
                        slotIndex = 5;
                    }

                    // Recalculate Start Time if overrides applied
                    startStr = customTime ? customTime.start : timeSlots[slotIndex].start;

                    // Calculate End Time
                    let finalTime = customTime;
                    if (!finalTime) {
                        const [h, m] = startStr.split(':').map(Number);
                        const startDate = new Date();
                        startDate.setHours(h, m, 0, 0);
                        const endDate = new Date(startDate.getTime() + durationMins * 60000);

                        const endH = endDate.getHours().toString().padStart(2, '0');
                        const endM = endDate.getMinutes().toString().padStart(2, '0');
                        finalTime = { start: startStr, end: `${endH}:${endM}` };
                    }

                    classes.push({
                        subject: line,
                        time: finalTime,
                        faculty: ""
                    });

                    // --- Slot Consumption ---
                    if (slotIndex < timeSlots.length) {
                        slotIndex++;

                        const [fEndH, fEndM] = finalTime.end.split(':').map(Number);
                        const endTimeMins = fEndH * 60 + fEndM;

                        while (slotIndex < timeSlots.length) {
                            const [sH, sM] = timeSlots[slotIndex].start.split(':').map(Number);
                            const slotStartMins = sH * 60 + sM;

                            // Consumed if class ends > slot start
                            if (endTimeMins > slotStartMins) {
                                slotIndex++;
                            } else {
                                break;
                            }
                        }
                    }
                }
            }
            schedule[currentDay] = classes;
        }

        const existingIndex = timetables.findIndex(t => t.section === sectionCode);
        if (existingIndex !== -1) {
            const existingSchedule = timetables[existingIndex].schedule;
            for (const day of days) {
                if (schedule[day] && schedule[day].length > 0) {
                    if (!existingSchedule[day]) {
                        existingSchedule[day] = schedule[day];
                    } else {
                        const newItems = schedule[day].filter(newItem =>
                            !existingSchedule[day].some(existingItem => existingItem.subject === newItem.subject)
                        );
                        existingSchedule[day] = [...existingSchedule[day], ...newItems];
                    }
                }
            }
        } else {
            timetables.push({ section: sectionCode, schedule });
        }
    }

    console.log(`Extracted ${timetables.length} timetables.`);
    fs.writeFileSync(TIMETABLE_FILE, JSON.stringify(timetables, null, 2));
}

async function main() {
    await extractStudentData();
    await extractTimetable();
}

main();
