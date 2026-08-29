/**
 * ============================================
 * STORAGE MODULE
 * Handles all LocalStorage operations
 * ============================================
 */
const Storage = (() => {
    const PREFIX = 'taskflow_';

    /**
     * Get data from localStorage
     * @param {string} key - Storage key
     * @param {*} fallback - Default value if key doesn't exist
     * @returns {*} Parsed data or fallback
     */
    function get(key, fallback = null) {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            if (raw === null) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            console.warn(`Storage.get error for "${key}":`, e);
            return fallback;
        }
    }

    /**
     * Save data to localStorage
     * @param {string} key - Storage key
     * @param {*} value - Data to store
     */
    function set(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch (e) {
            console.error(`Storage.set error for "${key}":`, e);
        }
    }

    /**
     * Remove a key from localStorage
     * @param {string} key - Storage key to remove
     */
    function remove(key) {
        localStorage.removeItem(PREFIX + key);
    }

    /**
     * Clear all TaskFlow data from localStorage
     */
    function clearAll() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
        keys.forEach(k => localStorage.removeItem(k));
    }

    /**
     * Export all TaskFlow data as JSON object
     * @returns {object} All stored data
     */
    function exportAll() {
        const data = {};
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith(PREFIX)) {
                const cleanKey = k.replace(PREFIX, '');
                data[cleanKey] = get(cleanKey);
            }
        });
        return data;
    }

    /**
     * Import data from JSON object
     * @param {object} data - Data to import
     */
    function importAll(data) {
        if (typeof data !== 'object' || data === null) return;
        Object.entries(data).forEach(([key, value]) => {
            set(key, value);
        });
    }

    /**
     * Get storage usage in bytes
     * @returns {number} Bytes used by TaskFlow data
     */
    function getUsage() {
        let total = 0;
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith(PREFIX)) {
                total += k.length + (localStorage.getItem(k) || '').length;
            }
        });
        return total;
    }

    return { get, set, remove, clearAll, exportAll, importAll, getUsage };
})();
