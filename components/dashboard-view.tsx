'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Student, ClassSession, Timetable } from '@/lib/types'; // Consolidated types
import { getTimetable, getSectionNotice, getScheduleForDate } from '@/app/actions'; // Consolidated actions
import { Bell, Calendar, Clock, LogOut, ChevronDown, BookOpen, Megaphone, ChevronLeft, ChevronRight } from 'lucide-react'; // Consolidated icons

// Lazy load Admin Panel
import dynamic from 'next/dynamic';
const AdminPanel = dynamic(() => import('./admin-panel'));
import ThemeSwitcher from './theme-switcher';
// Import actions for notices


export default function DashboardView() {
    // Student & Timetable State
    const [student, setStudent] = useState<Student | null>(null);
    const [schedule, setSchedule] = useState<ClassSession[]>([]);
    // Use ISO Date string YYYY-MM-DD
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    // Notice State
    const [notice, setNotice] = useState<string | null>(null);

    // Admin State
    const [isAdmin, setIsAdmin] = useState(false);
    const [showAdminCode, setShowAdminCode] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [secretCodeInput, setSecretCodeInput] = useState('');
    const [codeError, setCodeError] = useState('');

    const router = useRouter();

    // Load User & Initial Data
    useEffect(() => {
        const stored = localStorage.getItem('student');
        if (!stored) {
            router.replace('/');
            return;
        }
        const user: Student = JSON.parse(stored);
        setStudent(user);

        // Check if Admin
        import('@/app/actions').then(mod => {
            mod.verifyAdmin(user.regNo).then(setIsAdmin);
        });

        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);

        // Fetch Notice
        getSectionNotice(user.section).then(setNotice);

        // Request Notification Permission
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, [router]);

    // Fetch Schedule when Date or User changes
    useEffect(() => {
        if (!student || !selectedDate) return;
        setLoading(true);
        getScheduleForDate(student.section, selectedDate).then(data => {
            setSchedule(data);
            setLoading(false);
        });
    }, [student, selectedDate]);

    const handleAdminAccess = async () => {
        setCodeError('');
        const mod = await import('@/app/actions');
        const isValid = await mod.verifyAdminCode(secretCodeInput);
        if (isValid) {
            setShowAdminCode(false);
            setShowAdminPanel(true);
            setSecretCodeInput('');
        } else {
            setCodeError('Invalid Access Code');
        }
    };

    // Notification Logic
    useEffect(() => {
        if (!schedule || !selectedDate || permission !== 'granted') return;

        // Only notify if selectedDate is TODAY
        const today = new Date().toISOString().split('T')[0];
        if (selectedDate !== today) return;

        const interval = setInterval(checkNotifications, 60000); // 1 min
        checkNotifications();

        return () => clearInterval(interval);

        function checkNotifications() {
            const now = new Date();
            const currentSchedule = schedule; // Use recent schedule

            currentSchedule.forEach(cls => {
                if (cls.isCancelled) return;

                const [h, m] = cls.time.start.split(':').map(Number);
                const classTime = new Date();
                classTime.setHours(h, m, 0, 0);

                const diffMs = classTime.getTime() - now.getTime();
                const diffMins = Math.round(diffMs / 60000);

                if (diffMins === 90) {
                    new Notification(`Upcoming Class: ${cls.subject}`, {
                        body: `Starts in 90 minutes (${cls.time.start}). Get ready!`,
                        icon: '/icon.png'
                    });
                }
            });
        }
    }, [schedule, selectedDate, permission]);

    const requestPermission = async () => {
        if (!('Notification' in window)) return;
        const perm = await Notification.requestPermission();
        setPermission(perm);
    };

    const handleLogout = () => {
        localStorage.removeItem('student');
        router.push('/');
    };

    // Date Navigation
    const changeDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    // Date Display Formatter
    const formatDateDisplay = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
    };

    if (loading && !schedule.length) { // Only show full loader on initial load
        return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500">Loading your schedule...</div>;
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-500">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand-500 via-brand-400 to-brand-600">
                        Campus Sync
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                            Welcome back, {student?.name}
                        </p>
                        <span className="px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs font-bold border border-brand-200 dark:border-brand-800">
                            Section {student?.section}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeSwitcher />

                    {isAdmin && (
                        <button
                            onClick={() => setShowAdminCode(true)}
                            className="p-2 text-brand-600 bg-brand-50 dark:bg-brand-900/20 rounded-full hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                            title="Admin Panel"
                        >
                            <div className="w-5 h-5 font-bold flex items-center justify-center">A</div>
                        </button>
                    )}
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

                {/* Notice Banner */}
                {notice && (
                    <div className="bg-gradient-to-r from-brand-500 to-brand-600 text-white p-4 rounded-xl shadow-lg flex items-start gap-3 animate-in slide-in-from-top-4">
                        <Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5 animate-bounce" />
                        <div>
                            <h3 className="font-bold text-sm uppercase tracking-wide opacity-90">Notice</h3>
                            <p className="text-white/95 font-medium">{notice}</p>
                        </div>
                    </div>
                )}

                {/* Date Controls */}
                <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <button onClick={() => changeDate(-1)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500">
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="text-center">
                        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Schedule For</div>
                        <div className="text-lg font-bold text-brand-600 dark:text-brand-400">{formatDateDisplay(selectedDate)}</div>
                    </div>

                    <button onClick={() => changeDate(1)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Schedule Sections */}
                <div className="space-y-8 min-h-[300px]">
                    {loading ? (
                        <div className="text-center py-10 text-zinc-400 animate-pulse">Loading schedule...</div>
                    ) : (
                        (() => {
                            const now = new Date();
                            // Only calculate "Current/Upcoming" if selectedDate is TODAY
                            const isToday = selectedDate === now.toISOString().split('T')[0];
                            const currentMinutes = now.getHours() * 60 + now.getMinutes();
                            const parseTime = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

                            let upcomingLocal = null;
                            let currentLocal = null;

                            if (isToday) {
                                upcomingLocal = schedule.find(c => parseTime(c.time.start) > currentMinutes);
                                currentLocal = schedule.find(c => {
                                    const start = parseTime(c.time.start);
                                    const end = parseTime(c.time.end);
                                    return currentMinutes >= start && currentMinutes < end;
                                });
                            }

                            return (
                                <>
                                    {/* Ongoing (Only Today) */}
                                    {isToday && (
                                        <section>
                                            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">
                                                Current Class
                                            </h3>
                                            {currentLocal ? (
                                                <div className={`border rounded-xl p-5 shadow-sm transition-colors ${currentLocal.isCancelled
                                                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                                                    : 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800'}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div className={currentLocal.isCancelled ? 'opacity-75' : ''}>
                                                            <h3 className={`text-xl font-bold ${currentLocal.isCancelled
                                                                ? 'text-red-700 dark:text-red-400 line-through decoration-red-500/50'
                                                                : 'text-brand-700 dark:text-brand-300'}`}>
                                                                {currentLocal.subject}
                                                            </h3>
                                                            <p className={`text-sm mt-1 flex items-center gap-2 ${currentLocal.isCancelled
                                                                ? 'text-red-600/80 dark:text-red-400/80'
                                                                : 'text-brand-600/80 dark:text-brand-400'}`}>
                                                                <BookOpen className="w-4 h-4" />
                                                                {currentLocal.faculty || 'No Faculty Info'}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold shadow-sm ${currentLocal.isCancelled
                                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                                                : 'bg-white dark:bg-zinc-900 text-brand-600 dark:text-brand-400'}`}>
                                                                <Clock className="w-4 h-4" />
                                                                {currentLocal.time.start} - {currentLocal.time.end}
                                                            </div>
                                                            <div className={`mt-2 text-xs font-semibold uppercase ${currentLocal.isCancelled
                                                                ? 'text-red-600 dark:text-red-400'
                                                                : 'text-brand-500 animate-pulse'}`}>
                                                                {currentLocal.isCancelled ? 'Cancelled' : 'Happening Now'}
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
                                    )}

                                    {/* Upcoming (Only Today) */}
                                    {isToday && (
                                        <section>
                                            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">
                                                Upcoming Class
                                            </h3>
                                            {upcomingLocal ? (
                                                <div className={`bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm border-l-4 ${upcomingLocal.isCancelled
                                                    ? 'border-zinc-200 dark:border-zinc-800 border-l-red-500'
                                                    : 'border-zinc-200 dark:border-zinc-800 border-l-brand-500'}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div className={upcomingLocal.isCancelled ? 'opacity-50' : ''}>
                                                            <h3 className={`text-lg font-bold ${upcomingLocal.isCancelled
                                                                ? 'text-zinc-500 line-through decoration-red-500'
                                                                : 'text-zinc-800 dark:text-zinc-100'}`}>
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
                                                            {upcomingLocal.isCancelled && (
                                                                <span className="text-xs font-bold text-red-500 uppercase">Cancelled</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-zinc-400 dark:text-zinc-600 text-sm italic">
                                                    No more classes for today.
                                                </div>
                                            )}
                                        </section>
                                    )}

                                    {/* All Classes */}
                                    <section>
                                        <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                                            {isToday ? "All Classes Today" : "Schedule"}
                                            <span className="text-xs normal-case bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                                {schedule.length} total
                                            </span>
                                        </h3>
                                        <div className="space-y-3">
                                            {schedule.length === 0 ? (
                                                <div className="text-zinc-400 text-center italic py-4">No classes scheduled.</div>
                                            ) : schedule.map((item, idx) => (
                                                <div key={idx} className={`group flex items-center gap-4 p-4 rounded-lg border transition-all ${(isToday && item === currentLocal)
                                                    ? (item.isCancelled
                                                        ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                                                        : 'bg-brand-50/50 dark:bg-brand-900/10 border-brand-200 dark:border-brand-800')
                                                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                                                    } hover:border-zinc-300 dark:hover:border-zinc-700`}>

                                                    <div className="w-16 flex-shrink-0 text-center">
                                                        <div className="text-xs font-bold text-zinc-500 uppercase">Start</div>
                                                        <div className={`text-sm font-mono font-medium ${item.isCancelled ? 'text-zinc-400 line-through' : 'text-zinc-900 dark:text-zinc-100'}`}>{item.time.start}</div>
                                                    </div>
                                                    <div className="w-16 flex-shrink-0 text-center border-l border-zinc-100 dark:border-zinc-800">
                                                        <div className="text-xs font-bold text-zinc-500 uppercase">End</div>
                                                        <div className={`text-sm font-mono ${item.isCancelled ? 'text-zinc-400 line-through' : 'text-zinc-500 dark:text-zinc-400'}`}>{item.time.end}</div>
                                                    </div>
                                                    <div className="flex-grow pl-4 border-l border-zinc-100 dark:border-zinc-800">
                                                        <div className={`font-semibold transition-colors ${item.isCancelled
                                                            ? 'text-zinc-400 line-through decoration-red-500'
                                                            : 'text-zinc-800 dark:text-zinc-100 group-hover:text-brand-600'}`}>
                                                            {item.subject}
                                                        </div>
                                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                            {item.faculty}
                                                            {item.isCancelled && <span className="text-red-500 font-bold ml-2 uppercase text-[10px]">Cancelled</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </>
                            );
                        })()
                    )}
                </div>
            </main>
            {/* Admin Modules */}
            {/* 1. Code Entry Modal */}
            {showAdminCode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl w-full max-w-sm border border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-lg font-bold mb-4">Admin Authentication</h3>
                        <p className="text-sm text-zinc-500 mb-4">Enter the secret code to proceed.</p>
                        <input
                            type="password"
                            value={secretCodeInput}
                            onChange={(e) => setSecretCodeInput(e.target.value)}
                            className="w-full p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 mb-4 dark:bg-zinc-950"
                            placeholder="Secret Code"
                        />
                        {codeError && <p className="text-red-500 text-sm mb-4">{codeError}</p>}
                        <div className="flex gap-2">
                            <button onClick={() => setShowAdminCode(false)} className="flex-1 py-2 text-zinc-600 bg-zinc-100 rounded-lg">Cancel</button>
                            <button onClick={handleAdminAccess} className="flex-1 py-2 text-white bg-brand-600 rounded-lg">Verify</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Admin Panel */}
            {showAdminPanel && student && (
                <AdminPanel regNo={student.regNo} onClose={() => setShowAdminPanel(false)} />
            )}
        </div>
    );
}


