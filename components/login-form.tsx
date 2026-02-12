'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/app/actions';
import { User, Loader2 } from 'lucide-react';
import ThemeSwitcher from './theme-switcher';

export default function LoginForm() {
    const [regNo, setRegNo] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await login(regNo);
            if (result.success) {
                // Store student data in localStorage for simplicity (or use cookie/session)
                // Since this is a simple app without real backend auth, localStorage is fine for demo.
                localStorage.setItem('student', JSON.stringify(result.student));
                router.push('/dashboard');
            } else {
                setError(result.error || 'Login failed');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 relative transition-colors duration-500">
            {/* Theme Switcher absolute positioned */}
            <div className="absolute top-4 right-4">
                <ThemeSwitcher />
            </div>

            <div className="p-8 space-y-6">
                <div className="text-center">
                    <h2 className="mb-2 text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand-500 via-brand-400 to-brand-600">
                        Campus Sync
                    </h2>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        Welcome Back
                    </h1>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        Enter your Registration Number to access your timetable
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <User className="w-5 h-5 text-zinc-400" />
                        </div>
                        <input
                            type="text"
                            required
                            value={regNo}
                            onChange={(e) => setRegNo(e.target.value)}
                            className="block w-full py-3 pl-10 pr-3 text-zinc-900 placeholder-zinc-500 bg-zinc-50 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder-zinc-400 transition-all duration-200"
                            placeholder="Registration Number (e.g. 251090070066)"
                        />
                    </div>

                    {error && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg dark:bg-red-900/20 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-brand-500/30"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
