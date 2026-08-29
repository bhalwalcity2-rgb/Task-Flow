/**
 * ============================================
 * APP MODULE
 * Core application logic, navigation, UI events
 * ============================================
 */
const App = (() => {
    /* ---- DOM References ---- */
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mainContent = document.getElementById('mainContent');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const navbarDate = document.getElementById('navbarDate');
    const greetingText = document.getElementById('greetingText');
    const quickNoteInput = document.getElementById('quickNoteInput');
    const toastContainer = document.getElementById('toastContainer');
    const globalSearch = document.getElementById('globalSearch');

    /**
     * Boot the application
     */
    function init() {
        Settings.init();
        Settings.watchSystemTheme();
        setupSidebar();
        setupDarkMode();
        setupDate();
        setupGreeting();
        setupQuickNotes();
        setupKeyboardShortcuts();
        setupQuickAdd();
        setupGlobalSearch();
        setupNotificationPanel();

        // Data modules — init before navigation restores the last
        // active page, since Calendar needs them ready immediately.
        Tasks.init();
        Projects.init();
        Notes.init();

        setupNavigation();
        updateDashboardStats();

        // Restore sidebar state
        if (Settings.getSetting('sidebarCollapsed')) {
            sidebar.classList.add('collapsed');
            document.body.classList.add('sidebar-collapsed');
        }
    }

    /* ============================================
       NOTIFICATIONS PANEL (Navbar bell dropdown)
       ============================================ */
    function setupNotificationPanel() {
        const btn = document.getElementById('notificationBtn');
        const panel = document.getElementById('notificationPanel');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const willOpen = !panel.classList.contains('visible');
            if (willOpen) renderNotificationPanel();
            panel.classList.toggle('visible', willOpen);
        });

        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && e.target !== btn) {
                panel.classList.remove('visible');
            }
        });
    }

    function renderNotificationPanel() {
        const list = document.getElementById('notificationPanelList');
        if (!list || typeof Tasks === 'undefined') return;

        const tasks = Tasks.getAll().filter(t => {
            if (t.archived || t.status === 'completed' || t.status === 'cancelled') return false;
            return !!t.dueDate;
        });

        const overdue = tasks.filter(t => Tasks.getDaysDiff(t.dueDate) < 0);
        const today = tasks.filter(t => Tasks.getDaysDiff(t.dueDate) === 0);
        const soon = tasks.filter(t => {
            const d = Tasks.getDaysDiff(t.dueDate);
            return d > 0 && d <= 7;
        });

        const groups = [
            { label: 'Overdue', items: overdue, cls: 'due-overdue' },
            { label: 'Due Today', items: today, cls: 'due-today' },
            { label: 'Due This Week', items: soon, cls: 'due-week' }
        ].filter(g => g.items.length > 0);

        if (groups.length === 0) {
            list.innerHTML = `<div class="empty-state" style="padding: 24px 12px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                <p style="font-size:0.8rem;">You're all caught up!</p>
            </div>`;
            return;
        }

        list.innerHTML = groups.map(g => `
            <div class="notification-group">
                <div class="notification-group-label">${g.label}</div>
                ${g.items.slice(0, 5).map(t => `
                    <div class="notification-row" data-id="${t.id}">
                        <span class="priority-dot ${t.priority}"></span>
                        <span class="notification-row-title">${escapeHtml(t.title)}</span>
                        <span class="due-badge ${g.cls}" style="font-size:0.65rem;">${Tasks.getCountdownInfo(t.dueDate).text}</span>
                    </div>
                `).join('')}
            </div>
        `).join('');

        list.querySelectorAll('.notification-row').forEach(row => {
            row.addEventListener('click', () => {
                document.getElementById('notificationPanel').classList.remove('visible');
                navigateTo('tasks');
                setTimeout(() => Tasks.openModal(row.dataset.id), 150);
            });
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ============================================
       QUICK ADD (Navbar button)
       ============================================ */
    function setupQuickAdd() {
        const quickAddBtn = document.getElementById('quickAddBtn');
        quickAddBtn.addEventListener('click', () => {
            Tasks.openModal();
        });
    }

    /* ============================================
       GLOBAL SEARCH (Navbar)
       Jumps to Tasks page and filters when typing
       ============================================ */
    function setupGlobalSearch() {
        globalSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && globalSearch.value.trim()) {
                navigateTo('tasks');
                const taskSearchInput = document.getElementById('taskSearchInput');
                if (taskSearchInput) {
                    taskSearchInput.value = globalSearch.value.trim();
                    taskSearchInput.dispatchEvent(new Event('input'));
                }
                globalSearch.value = '';
                globalSearch.blur();
            }
        });
    }

    /* ============================================
       NAVIGATION
       ============================================ */
    function setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item[data-page]');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                navigateTo(page);

                // Close mobile sidebar
                if (window.innerWidth <= 768) {
                    closeMobileSidebar();
                }
            });
        });

        // Load last page or default to dashboard
        const lastPage = Storage.get('currentPage', 'dashboard');
        navigateTo(lastPage);
    }

    function navigateTo(pageId) {
        // Update nav active state
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageId);
        });

        // Show correct page
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        const target = document.getElementById(`page-${pageId}`);
        if (target) {
            target.classList.add('active');
        }

        Storage.set('currentPage', pageId);

        // Lazy-init / resize Calendar only when its page becomes visible
        if (pageId === 'calendar' && typeof Calendar !== 'undefined') {
            Calendar.onPageShow();
        }

        // Lazy-init / rebuild Kanban board only when its page becomes visible
        if (pageId === 'kanban' && typeof Kanban !== 'undefined') {
            Kanban.onPageShow();
        }

        // Lazy-init dashboard charts (canvas needs a visible, sized container)
        if (pageId === 'dashboard' && typeof Charts !== 'undefined') {
            Charts.onDashboardShow();
        }

        // Lazy-init Reports page charts
        if (pageId === 'reports' && typeof Charts !== 'undefined') {
            Charts.onReportsPageShow();
        }
    }

    /* ============================================
       SIDEBAR
       ============================================ */
    function setupSidebar() {
        // Desktop collapse
        sidebarCollapseBtn.addEventListener('click', () => {
            const collapsed = sidebar.classList.toggle('collapsed');
            document.body.classList.toggle('sidebar-collapsed', collapsed);
            Settings.setSetting('sidebarCollapsed', collapsed);
        });

        // Mobile menu
        mobileMenuBtn.addEventListener('click', openMobileSidebar);
        sidebarOverlay.addEventListener('click', closeMobileSidebar);
    }

    function openMobileSidebar() {
        sidebar.classList.add('mobile-open');
        sidebarOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileSidebar() {
        sidebar.classList.remove('mobile-open');
        sidebarOverlay.classList.remove('visible');
        document.body.style.overflow = '';
    }

    /* ============================================
       DARK MODE
       ============================================ */
    function setupDarkMode() {
        darkModeToggle.addEventListener('click', () => {
            const newTheme = Settings.toggleTheme();
            showToast(`Switched to ${newTheme} mode`, 'info');
        });
    }

    /* ============================================
       DATE & GREETING
       ============================================ */
    function setupDate() {
        function updateDate() {
            const now = new Date();
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            navbarDate.textContent = now.toLocaleDateString('en-US', options);
        }
        updateDate();
        setInterval(updateDate, 60000);
    }

    function setupGreeting() {
        const hour = new Date().getHours();
        let greeting;
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        greetingText.textContent = `${greeting}! Here's your productivity overview.`;
    }

    /* ============================================
       QUICK NOTES (Dashboard widget)
       ============================================ */
    function setupQuickNotes() {
        const saved = Storage.get('quickNote', '');
        quickNoteInput.value = saved;

        // Auto-save on input with debounce
        let timer;
        quickNoteInput.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                Storage.set('quickNote', quickNoteInput.value);
            }, 400);
        });
    }

    /* ============================================
       KEYBOARD SHORTCUTS
       ============================================ */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + K → Focus search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                globalSearch.focus();
            }

            // Escape → Close mobile sidebar
            if (e.key === 'Escape') {
                closeMobileSidebar();
                globalSearch.blur();
            }
        });
    }

    /* ============================================
       DASHBOARD STATS (Phase 1 — placeholder)
       Will be wired to real data in Phase 2
       ============================================ */
    function updateDashboardStats() {
        const tasks = Storage.get('tasks', []);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const inProgress = tasks.filter(t => t.status === 'in-progress').length;
        const pending = tasks.filter(t => t.status === 'todo' || t.status === 'waiting').length;
        const overdue = tasks.filter(t => {
            if (t.status === 'completed' || t.status === 'cancelled') return false;
            return t.dueDate && new Date(t.dueDate) < today;
        }).length;

        const dueToday = tasks.filter(t => {
            if (t.status === 'completed' || t.status === 'cancelled') return false;
            if (!t.dueDate) return false;
            const d = new Date(t.dueDate);
            return d.toDateString() === today.toDateString();
        }).length;

        // Due this week
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
        const dueWeek = tasks.filter(t => {
            if (t.status === 'completed' || t.status === 'cancelled') return false;
            if (!t.dueDate) return false;
            const d = new Date(t.dueDate);
            return d >= today && d <= weekEnd;
        }).length;

        const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Animate the stat values
        animateValue('statTotal', total);
        animateValue('statCompleted', completed);
        animateValue('statPending', pending);
        animateValue('statInProgress', inProgress);
        animateValue('statOverdue', overdue);
        animateValue('statDueToday', dueToday);
        animateValue('statDueWeek', dueWeek);
        document.getElementById('statCompletionPct').textContent = completionPct + '%';

        // Update notification badge with overdue count
        const badge = document.getElementById('notificationBadge');
        badge.textContent = overdue;
        badge.dataset.count = overdue;
    }

    /**
     * Animate a number from 0 to target
     */
    function animateValue(elementId, target) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const duration = 600;
        const start = parseInt(el.textContent) || 0;
        if (start === target) { el.textContent = target; return; }

        const startTime = performance.now();
        function step(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(start + (target - start) * eased);
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    /* ============================================
       TOAST NOTIFICATIONS
       ============================================ */
    function showToast(message, type = 'info', duration = 3000) {
        const iconMap = {
            success: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${iconMap[type] || iconMap.info}</span><span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /* ---- Public API ---- */
    return { init, navigateTo, showToast, updateDashboardStats };
})();

/* Boot on DOM ready */
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
