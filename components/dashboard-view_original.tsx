'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Student, Timetable, ClassSession } from '@/lib/types';
import { getTimetable } from '@/app/actions';
import { Bell, Calendar, Clock, LogOut, ChevronDown, BookOpen } from 'lucide-react';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function DashboardView() {
    const [student, setStudent] = useState<Student | null>(null);
    const [timetable, setTimetable] = useState<Timetable | null>(null);
    const [selectedDay, setSelectedDay] = useState<string>('MON'); // Default
    const [loading, setLoading] = useState(true);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const router = useRouter();

    // Load User & Timetable
    useEffect(() => {
        const stored = localStorage.getItem('student');
        if (!stored) {
            router.replace('/');
            return;
        }
        const user: Student = JSON.parse(stored);
        setStudent(user);

        // Set default day to today
        const dayIndex = new Date().getDay(); // 0=Sun, 1=Mon...
        const map = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        // If Sunday, default to MON. Else current day.
        const today = (dayIndex === 0) ? 'MON' : map[dayIndex];
        setSelectedDay(today);

        // Fetch Timetable
        getTimetable(user.section).then(tt => {
            setTimetable(tt);
            setLoading(false);
        });

        // Request Notification Permission
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, [router]);

    // Notification Logic
    useEffect(() => {
        if (!timetable || !selectedDay || permission !== 'granted') return;

        // Check every minute
        const interval = setInterval(() => {
            checkNotifications();
        }, 60000); // 1 min

        checkNotifications(); // Check immediately

        return () => clearInterval(interval);

        function checkNotifications() {
            if (!timetable) return;

            const now = new Date();
            const currentDayIndex = now.getDay();
            const map = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            const todayString = map[currentDayIndex];

            // Notifications only for TODAY's classes
            const dailySchedule = timetable.schedule[todayString];
            if (!dailySchedule) return;

            dailySchedule.forEach(cls => {
                // cls.time.start is "08:00" string
                // Parse class time
                const [h, m] = cls.time.start.split(':').map(Number);
                const classTime = new Date();
                classTime.setHours(h, m, 0, 0);

                // Helper to add minutes
                const diffMs = classTime.getTime() - now.getTime();
                const diffMins = Math.round(diffMs / 60000);

                if (diffMins === 90) {
                    sendNotification(cls);
                }
            });
        }

        function sendNotification(cls: ClassSession) {
            new Notification(`Upcoming Class: ${cls.subject}`, {
                body: `Starts in 90 minutes (${cls.time.start}). Get ready!`,
                icon: '/icon.png' // Optional
            });
        }

    }, [timetable, permission]);

    const requestPermission = async () => {
        if (!('Notification' in window)) return;
        const perm = await Notification.requestPermission();
        setPermission(perm);
    };

    const handleLogout = () => {
        localStorage.removeItem('student');
        router.push('/');
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500">Loading your schedule...</div>;
    }

    const currentSchedule = timetable?.schedule[selectedDay] || [];

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600">
                        ProjectN
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Welcome, {student?.name} <span className="text-indigo-400 font-semibold">• Section {student?.section}</span>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {permission === 'default' && (
                        <button onClick={requestPermission} className="p-2 text-amber-600 bg-amber-100 rounded-full hover:bg-amber-200 transition-colors" title="Enable Notifications">
                            <Bell className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-6 space-y-6">
                {/* Controls */}
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-indigo-500" />
                        Timetable
                    </h2>

                    <div className="relative">
                        <select
                            value={selectedDay}
                            onChange={(e) => setSelectedDay(e.target.value)}
                            className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg py-2 pl-4 pr-10 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                        >
                            {DAYS.map(day => (
                                <option key={day} value={day}>{day}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                {/* Schedule Sections */}
                <div className="space-y-8">

                    {/* 1. Ongoing/Upcoming Logic */}
                    {(() => {
                        const now = new Date();
                        const currentMinutes = now.getHours() * 60 + now.getMinutes();
                        const parseTime = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

                        const upcomingLocal = currentSchedule.find(c => parseTime(c.time.start) > currentMinutes);
                        const currentLocal = currentSchedule.find(c => {
                            const start = parseTime(c.time.start);
                            const end = parseTime(c.time.end);
                            return currentMinutes >= start && currentMinutes < end;
                        });

                        return (
                            <>
                                {/* Ongoing */}
                                <section>
                                    <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">
                                        Current Class
                                    </h3>
                                    {currentLocal ? (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 shadow-sm">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                                                        {currentLocal.subject}
                                                    </h3>
                                                    <p className="text-sm text-indigo-600/80 dark:text-indigo-400 mt-1 flex items-center gap-2">
                                                        <BookOpen className="w-4 h-4" />
                                                        {currentLocal.faculty || 'No Faculty Info'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-zinc-900 rounded-full text-sm font-bold text-indigo-600 dark:text-indigo-400 shadow-sm">
                                                        <Clock className="w-4 h-4" />
                                                        {currentLocal.time.start} - {currentLocal.time.end}
                                                    </div>
                                                    <div className="mt-2 text-xs font-semibold text-indigo-500 uppercase animate-pulse">
                                                        Happening Now
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-zinc-400 dark:text-zinc-600 text-sm italic">
                                            No class currently in session.
                                        </div>
                                    )}
                                </section>

                                {/* Upcoming */}
                                <section>
                                    <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">
                                        Upcoming Class
                                    </h3>
                                    {upcomingLocal ? (
                                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm border-l-4 border-l-emerald-500">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
                                                        {upcomingLocal.subject}
                                                    </h3>
                                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                                        {upcomingLocal.faculty}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-mono font-medium text-zinc-600 dark:text-zinc-300">
                                                        Starts at {upcomingLocal.time.start}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-zinc-400 dark:text-zinc-600 text-sm italic">
                                            No more classes for today.
                                        </div>
                                    )}
                                </section>

                                {/* All Classes */}
                                <section>
                                    <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                                        All Classes
                                        <span className="text-xs normal-case bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                            {currentSchedule.length} total
                                        </span>
                                    </h3>
                                    <div className="space-y-3">
                                        {currentSchedule.map((item, idx) => (
                                            <div key={idx} className={`group flex items-center gap-4 p-4 rounded-lg border ${item === currentLocal
                                                ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800'
                                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                                                } hover:border-zinc-300 dark:hover:border-zinc-700 transition-all`}>
                                                <div className="w-16 flex-shrink-0 text-center">
                                                    <div className="text-xs font-bold text-zinc-500 uppercase">Start</div>
                                                    <div className="text-sm font-mono font-medium text-zinc-900 dark:text-zinc-100">{item.time.start}</div>
                                                </div>
                                                <div className="w-16 flex-shrink-0 text-center border-l border-zinc-100 dark:border-zinc-800">
                                                    <div className="text-xs font-bold text-zinc-500 uppercase">End</div>
                                                    <div className="text-sm font-mono text-zinc-500 dark:text-zinc-400">{item.time.end}</div>
                                                </div>
                                                <div className="flex-grow pl-4 border-l border-zinc-100 dark:border-zinc-800">
                                                    <div className="font-semibold text-zinc-800 dark:text-zinc-100 group-hover:text-indigo-600 transition-colors">
                                                        {item.subject}
                                                    </div>
                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                        {item.faculty}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </>
                        );
                    })()}
                </div>
            </main>
        </div>
    );
}
