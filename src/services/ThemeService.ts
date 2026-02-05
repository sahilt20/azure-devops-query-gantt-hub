/**
 * Theme Service
 * Manages light/dark theme preference with localStorage persistence
 */

export type Theme = 'light' | 'dark';

class ThemeService {
    private static instance: ThemeService;
    private readonly STORAGE_KEY = 'gantt-theme';
    private currentTheme: Theme;

    private constructor() {
        // Initialize theme from localStorage or system preference
        this.currentTheme = this.loadTheme();
    }

    public static getInstance(): ThemeService {
        if (!ThemeService.instance) {
            ThemeService.instance = new ThemeService();
        }
        return ThemeService.instance;
    }

    /**
     * Load theme from localStorage or detect system preference
     */
    private loadTheme(): Theme {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored === 'light' || stored === 'dark') {
                return stored;
            }
        } catch (e) {
            console.warn('Failed to load theme from localStorage:', e);
        }

        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }

        return 'dark'; // Default to dark theme
    }

    /**
     * Get current theme
     */
    public getTheme(): Theme {
        return this.currentTheme;
    }

    /**
     * Set theme and persist to localStorage
     */
    public setTheme(theme: Theme): void {
        this.currentTheme = theme;
        try {
            localStorage.setItem(this.STORAGE_KEY, theme);
        } catch (e) {
            console.warn('Failed to save theme to localStorage:', e);
        }
    }

    /**
     * Toggle between light and dark themes
     */
    public toggleTheme(): Theme {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        return newTheme;
    }

    /**
     * Check if dark theme is active
     */
    public isDark(): boolean {
        return this.currentTheme === 'dark';
    }

    /**
     * Check if light theme is active
     */
    public isLight(): boolean {
        return this.currentTheme === 'light';
    }
}

export const themeService = ThemeService.getInstance();
export default themeService;
