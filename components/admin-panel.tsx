'use client';

import { useState, useEffect } from 'react';
import { getAllSections, getTimetable, updateClassSession, addAdmin, verifyAdmin, getAdmins, addClassSession, deleteClassSession, updateSectionNotice, getSectionNotice, getScheduleForDate } from '@/app/actions';
import { Timetable, ClassSession } from '@/lib/types';
import { Loader2, Plus, Save, Trash2, Users, Calendar, Shield, Megaphone, Check, X, CalendarDays, Repeat } from 'lucide-react';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function AdminPanel({ regNo, onClose }: { regNo: string, onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<'timetable' | 'admins' | 'notices'>('timetable');
    const [sections, setSections] = useState<string[]>([]);
    const [selectedSection, setSelectedSection] = useState<string>('');

    // Date/Day State
    // We default to Today in YYYY-MM-DD
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [computedDay, setComputedDay] = useState<string>(''); // MON, TUE...

    const [schedule, setSchedule] = useState<ClassSession[]>([]);
    const [loadingSchedule, setLoadingSchedule] = useState(false);

    // Edit State
    const [editingSlot, setEditingSlot] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<ClassSession | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newClass, setNewClass] = useState<ClassSession>({ subject: '', faculty: '', time: { start: '', end: '' } });

    // Mode: Recurring vs Date Specific
    const [applyToDateOnly, setApplyToDateOnly] = useState(false);

    // Admin Management State
    const [adminList, setAdminList] = useState<string[]>([]);
    const [newAdminRegNo, setNewAdminRegNo] = useState('');
    const [adminMsg, setAdminMsg] = useState('');

    // Notice State
    const [noticeMsg, setNoticeMsg] = useState('');
    const [noticeStatus, setNoticeStatus] = useState('');

    useEffect(() => {
        loadSections();
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
    }, []);

    // Update Computed Day when Date changes
    useEffect(() => {
        if (!selectedDate) return;
        const date = new Date(selectedDate);
        const dayIndex = date.getDay();
        const map = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        setComputedDay(map[dayIndex]);
    }, [selectedDate]);

    useEffect(() => {
        if (selectedSection && selectedDate) {
            loadSchedule();
            loadNotice();
        }
    }, [selectedSection, selectedDate]);

    useEffect(() => {
        if (activeTab === 'admins') {
            loadAdmins();
        }
    }, [activeTab]);

    const loadSections = async () => {
        const secs = await getAllSections();
        setSections(secs);
        if (secs.length > 0) setSelectedSection(secs[0]);
    };

    const loadSchedule = async () => {
        setLoadingSchedule(true);
        // Use the new Date-Specific Fetcher
        const data = await getScheduleForDate(selectedSection, selectedDate);
        setSchedule(data || []);
        setLoadingSchedule(false);
    };

    const loadNotice = async () => {
        if (!selectedSection) return;
        const msg = await getSectionNotice(selectedSection);
        setNoticeMsg(msg || '');
    };

    const loadAdmins = async () => {
        const admins = await getAdmins(regNo);
        setAdminList(admins);
    };

    const handleEditClick = (session: ClassSession, index: number) => {
        setEditingSlot(index);
        setEditForm({ ...session });
    };

    const handleSave = async () => {
        if (editingSlot === null || !editForm) return;

        const target = applyToDateOnly ? selectedDate : computedDay; // "2025-02-12" or "WED"
        const result = await updateClassSession(regNo, selectedSection, target, editingSlot, editForm, applyToDateOnly);

        if (result.success) {
            setEditingSlot(null);
            loadSchedule();
        } else {
            alert('Failed to update: ' + result.error);
        }
    };

    const handleCancelToggle = async (index: number) => {
        const session = schedule[index];
        const updated = { ...session, isCancelled: !session.isCancelled };

        const target = applyToDateOnly ? selectedDate : computedDay;
        const result = await updateClassSession(regNo, selectedSection, target, index, updated, applyToDateOnly);

        if (result.success) loadSchedule();
    };

    const handleAddClass = async () => {
        if (!newClass.subject || !newClass.time.start || !newClass.time.end) return;

        const target = applyToDateOnly ? selectedDate : computedDay;
        const result = await addClassSession(regNo, selectedSection, target, newClass, applyToDateOnly);

        if (result.success) {
            setShowAddForm(false);
            setNewClass({ subject: '', faculty: '', time: { start: '', end: '' } });
            loadSchedule();
        } else {
            alert('Failed to add: ' + result.error);
        }
    };

    const handleDeleteClass = async (index: number) => {
        if (!confirm('Are you sure you want to delete this class?')) return;

        const target = applyToDateOnly ? selectedDate : computedDay;
        const result = await deleteClassSession(regNo, selectedSection, target, index, applyToDateOnly);

        if (result.success) loadSchedule();
    };

    const handleSaveNotice = async () => {
        setNoticeStatus('Saving...');
        const result = await updateSectionNotice(regNo, selectedSection, noticeMsg);
        if (result.success) {
            setNoticeStatus('Saved!');
        } else {
            setNoticeStatus('Error saving notice');
        }
        setTimeout(() => setNoticeStatus(''), 2000);
    };

    const handleAddAdmin = async () => {
        if (!newAdminRegNo) return;
        const result = await addAdmin(regNo, newAdminRegNo);
        if (result.success) {
            setAdminMsg('Admin added successfully.');
            setNewAdminRegNo('');
            loadAdmins();
        } else {
            setAdminMsg('Error: ' + result.error);
        }
        setTimeout(() => setAdminMsg(''), 3000);
    };

    // Helper for formatted date
    const formatDate = (d: string) => {
        if (!d) return '';
        return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-colors duration-500">
                {/* Header */}
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950">
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Shield className="w-6 h-6 text-indigo-600" />
                            Admin Panel
                        </h2>
                        <p className="text-sm text-zinc-500">Managing Campus Sync Data</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={() => setActiveTab('timetable')}
                        className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'timetable'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Manage Timetable
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('notices')}
                        className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'notices'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Megaphone className="w-4 h-4" />
                            Section Notice
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('admins')}
                        className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'admins'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Users className="w-4 h-4" />
                            Manage Admins
                        </div>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-zinc-900">

                    {/* TIMETABLE TAB */}
                    {activeTab === 'timetable' && (
                        <div className="space-y-6">
                            {/* Filters */}
                            <div className="flex flex-col md:flex-row gap-4 mb-6">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Section</label>
                                    <select
                                        value={selectedSection}
                                        onChange={(e) => setSelectedSection(e.target.value)}
                                        className="w-full p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-950"
                                    >
                                        {sections.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-full p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-950"
                                    />
                                    <div className="text-xs text-zinc-400 mt-1">Viewing: {formatDate(selectedDate)} ({computedDay})</div>
                                </div>
                            </div>

                            {/* Mode Toggle */}
                            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {applyToDateOnly ? <CalendarDays className="w-5 h-5 text-indigo-600" /> : <Repeat className="w-5 h-5 text-indigo-600" />}
                                    <div>
                                        <div className="font-bold text-indigo-900 dark:text-indigo-300">
                                            {applyToDateOnly ? `Editing Single Date: ${formatDate(selectedDate)}` : `Editing All ${computedDay}s`}
                                        </div>
                                        <div className="text-xs text-indigo-700 dark:text-indigo-400">
                                            {applyToDateOnly ? "Changes affect ONLY this specific date." : "Changes affect EVERY week."}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setApplyToDateOnly(!applyToDateOnly)}
                                    className="px-3 py-1.5 text-xs font-bold uppercase bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                >
                                    Switch to {applyToDateOnly ? "Recurring" : "Single Date"}
                                </button>
                            </div>

                            {/* Add Class Button */}
                            <button
                                onClick={() => setShowAddForm(!showAddForm)}
                                className="w-full py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-500 hover:border-indigo-500 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add New Class
                            </button>

                            {/* Add Class Form */}
                            {showAddForm && (
                                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <input
                                            placeholder="Subject"
                                            className="p-2 rounded border dark:bg-zinc-900"
                                            value={newClass.subject}
                                            onChange={e => setNewClass({ ...newClass, subject: e.target.value })}
                                        />
                                        <input
                                            placeholder="Faculty"
                                            className="p-2 rounded border dark:bg-zinc-900"
                                            value={newClass.faculty}
                                            onChange={e => setNewClass({ ...newClass, faculty: e.target.value })}
                                        />
                                        <input
                                            type="time"
                                            className="p-2 rounded border dark:bg-zinc-900"
                                            value={newClass.time.start}
                                            onChange={e => setNewClass({ ...newClass, time: { ...newClass.time, start: e.target.value } })}
                                        />
                                        <input
                                            type="time"
                                            className="p-2 rounded border dark:bg-zinc-900"
                                            value={newClass.time.end}
                                            onChange={e => setNewClass({ ...newClass, time: { ...newClass.time, end: e.target.value } })}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowAddForm(false)} className="px-3 py-1 text-sm text-zinc-500">Cancel</button>
                                        <button onClick={handleAddClass} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded">
                                            Add to {applyToDateOnly ? formatDate(selectedDate) : `All ${computedDay}s`}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Schedule List */}
                            {loadingSchedule ? (
                                <div className="text-center py-10 text-zinc-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Loading...</div>
                            ) : (
                                <div className="space-y-4">
                                    {schedule.length === 0 ? (
                                        <p className="text-zinc-500 italic text-center">No classes found for this day.</p>
                                    ) : (
                                        schedule.map((session, idx) => (
                                            <div key={idx} className={`p-4 rounded-xl border transition-all ${session.isCancelled
                                                ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800'
                                                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50'}`}>

                                                {editingSlot === idx ? (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="col-span-2 sm:col-span-1">
                                                            <label className="text-xs text-zinc-500">Subject</label>
                                                            <input
                                                                type="text"
                                                                value={editForm?.subject || ''}
                                                                onChange={(e) => setEditForm({ ...editForm!, subject: e.target.value })}
                                                                className="w-full p-2 border rounded bg-white dark:bg-zinc-900"
                                                            />
                                                        </div>
                                                        <div className="col-span-2 sm:col-span-1">
                                                            <label className="text-xs text-zinc-500">Faculty</label>
                                                            <input
                                                                type="text"
                                                                value={editForm?.faculty || ''}
                                                                onChange={(e) => setEditForm({ ...editForm!, faculty: e.target.value })}
                                                                className="w-full p-2 border rounded bg-white dark:bg-zinc-900"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-zinc-500">Start Time</label>
                                                            <input
                                                                type="time"
                                                                value={editForm?.time.start || ''}
                                                                onChange={(e) => setEditForm({ ...editForm!, time: { ...editForm!.time, start: e.target.value } })}
                                                                className="w-full p-2 border rounded bg-white dark:bg-zinc-900"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-zinc-500">End Time</label>
                                                            <input
                                                                type="time"
                                                                value={editForm?.time.end || ''}
                                                                onChange={(e) => setEditForm({ ...editForm!, time: { ...editForm!.time, end: e.target.value } })}
                                                                className="w-full p-2 border rounded bg-white dark:bg-zinc-900"
                                                            />
                                                        </div>
                                                        <div className="col-span-2 flex justify-end gap-2 mt-2">
                                                            <button onClick={() => setEditingSlot(null)} className="px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-200 rounded">Cancel</button>
                                                            <button onClick={handleSave} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Save Changes</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-center h-full">
                                                        <div className={session.isCancelled ? 'opacity-50 line-through decoration-red-500' : ''}>
                                                            <div className="font-bold text-lg">{session.subject} {session.isCancelled && <span className="text-xs text-red-500 ml-2 no-underline">(Cancelled)</span>}</div>
                                                            <div className="text-sm text-zinc-500">{session.faculty}</div>
                                                            <div className="text-xs font-mono text-zinc-400 mt-1">
                                                                {session.time.start} - {session.time.end}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleCancelToggle(idx)}
                                                                className={`p-2 rounded-lg border transition-colors ${session.isCancelled
                                                                    ? 'text-zinc-600 bg-zinc-100 border-zinc-200 hover:bg-zinc-200'
                                                                    : 'text-red-500 bg-red-50 border-red-100 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900'}`}
                                                                title={session.isCancelled ? "Restore Class" : "Cancel Class"}
                                                            >
                                                                {session.isCancelled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                                            </button>
                                                            <button
                                                                onClick={() => handleEditClick(session, idx)}
                                                                className="p-2 text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400"
                                                                title="Edit / Reschedule"
                                                            >
                                                                <Calendar className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClass(idx)}
                                                                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 rounded-lg transition-colors"
                                                                title="Delete Class"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* NOTICES TAB */}
                    {activeTab === 'notices' && (
                        <div className="max-w-xl mx-auto space-y-6">
                            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                <h3 className="text-indigo-800 dark:text-indigo-400 font-bold mb-1">Section Notice Board</h3>
                                <p className="text-sm text-indigo-700 dark:text-indigo-500">
                                    Broadcast a message to all students in <strong>Section {selectedSection}</strong>.
                                    Notices expire automatically after 24 hours.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-2">Notice Message</label>
                                    <textarea
                                        value={noticeMsg}
                                        onChange={(e) => setNoticeMsg(e.target.value)}
                                        className="w-full p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 h-32 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="e.g. Tomorrow's Lab is cancelled."
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-zinc-500">{noticeStatus}</span>
                                    <button
                                        onClick={handleSaveNotice}
                                        className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        Broadcast Notice
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ADMINS TAB */}
                    {activeTab === 'admins' && (
                        <div className="max-w-xl mx-auto space-y-6">
                            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                                <h3 className="text-amber-800 dark:text-amber-400 font-bold mb-1">Access Control</h3>
                                <p className="text-sm text-amber-700 dark:text-amber-500">
                                    Admins can edit any timetable and add other admins. Ensure you trust the Registration Number before adding.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-bold mb-2">Current Admins</h3>
                                <ul className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800">
                                    {adminList.map(adm => (
                                        <li key={adm} className="p-3 flex justify-between items-center">
                                            <span className="font-mono">{adm}</span>
                                            {adm === regNo && <span className="text-xs bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">You</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold mb-2">Add New Admin</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Registration Number"
                                        value={newAdminRegNo}
                                        onChange={(e) => setNewAdminRegNo(e.target.value)}
                                        className="flex-1 p-2 border rounded-lg dark:bg-zinc-950 dark:border-zinc-800"
                                    />
                                    <button
                                        onClick={handleAddAdmin}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                                    >
                                        Add
                                    </button>
                                </div>
                                {adminMsg && <p className="text-sm mt-2 text-indigo-600">{adminMsg}</p>}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
