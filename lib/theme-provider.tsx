'use client';

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "indigo" | "emerald" | "rose" | "amber" | "blue";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>("indigo");

    useEffect(() => {
        const stored = localStorage.getItem("campus-sync-theme") as Theme;
        if (stored) {
            setTheme(stored);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("campus-sync-theme", theme);
        const root = document.documentElement;
        root.classList.remove("theme-emerald", "theme-rose", "theme-amber", "theme-blue");

        if (theme !== "indigo") {
            root.classList.add(`theme-${theme}`);
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
