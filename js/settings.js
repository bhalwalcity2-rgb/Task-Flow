/**
 * ============================================
 * SETTINGS MODULE
 * Theme, preferences, and configuration
 * ============================================
 */
const Settings = (() => {
    const DEFAULTS = {
        theme: 'light',           // 'light' | 'dark' | 'auto'
        defaultPriority: 'medium',
        defaultProject: '',
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        sidebarCollapsed: false
    };

    /**
     * Initialize settings — load saved prefs and apply theme
     */
    function init() {
        const saved = Storage.get('settings', {});
        const settings = { ...DEFAULTS, ...saved };
        Storage.set('settings', settings);
        applyTheme(settings.theme);
    }

    /**
     * Get a specific setting value
     */
    function getSetting(key) {
        const settings = Storage.get('settings', DEFAULTS);
        return settings[key] !== undefined ? settings[key] : DEFAULTS[key];
    }

    /**
     * Update a setting
     */
    function setSetting(key, value) {
        const settings = Storage.get('settings', DEFAULTS);
        settings[key] = value;
        Storage.set('settings', settings);

        if (key === 'theme') applyTheme(value);
    }

    /**
     * Apply theme to document
     */
    function applyTheme(theme) {
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    /**
     * Toggle between light and dark
     */
    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        setSetting('theme', next);
        return next;
    }

    /**
     * Listen for system theme changes (when set to auto)
     */
    function watchSystemTheme() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (getSetting('theme') === 'auto') {
                applyTheme('auto');
            }
        });
    }

    return { init, getSetting, setSetting, applyTheme, toggleTheme, watchSystemTheme };
})();
