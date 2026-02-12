'use client';

import { useTheme } from "@/lib/theme-provider";
import { Palette } from "lucide-react";
import { useState } from "react";

const themes = [
    { id: 'indigo', color: 'bg-[#6366f1]' },
    { id: 'emerald', color: 'bg-[#10b981]' },
    { id: 'rose', color: 'bg-[#f43f5e]' },
    { id: 'amber', color: 'bg-[#f59e0b]' },
    { id: 'blue', color: 'bg-[#3b82f6]' },
] as const;

export default function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                title="Change Theme"
            >
                <Palette className="w-5 h-5" />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-1 min-w-[120px]">
                        <span className="text-xs font-semibold text-zinc-500 px-2 py-1 uppercase">Select Theme</span>
                        {themes.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => {
                                    setTheme(t.id);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${theme === t.id
                                    ? 'bg-zinc-100 dark:bg-zinc-800 font-medium'
                                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                            >
                                <div className={`w-3 h-3 rounded-full ${t.color}`} />
                                <span className="capitalize text-zinc-700 dark:text-zinc-300">{t.id}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
