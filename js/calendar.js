/**
 * ============================================
 * CALENDAR MODULE — Phase 3
 * Monthly/Weekly/Daily views, drag-to-reschedule,
 * click-a-date to see all tasks due that day
 * ============================================
 */
const Calendar = (() => {
    let calendarInstance = null;
    let initialized = false;
    let selectedDateStr = null;

    let el = {};

    /**
     * Lazily initialize the calendar — called the first time
     * the user navigates to the Calendar page (needs a visible,
     * sized container to render into).
     */
    function onPageShow() {
        cacheDom();

        if (!initialized) {
            buildCalendar();
            bindDayModalEvents();
            initialized = true;
        } else {
            refreshEvents();
        }

        // Always re-measure size in case sidebar/collapse changed
        // the available width while the page was hidden.
        setTimeout(() => {
            if (calendarInstance) calendarInstance.updateSize();
        }, 50);
    }

    function cacheDom() {
        el = {
            calendarEl: document.getElementById('calendarEl'),
            dayModalOverlay: document.getElementById('dayTasksModalOverlay'),
            dayModalTitle: document.getElementById('dayTasksModalTitle'),
            dayModalCloseBtn: document.getElementById('dayTasksModalCloseBtn'),
            dayTasksList: document.getElementById('dayTasksList'),
            dayTasksAddBtn: document.getElementById('dayTasksAddBtn')
        };
    }

    function buildCalendar() {
        calendarInstance = new FullCalendar.Calendar(el.calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            height: 'auto',
            editable: true,
            dayMaxEvents: 3,
            events: buildEventList(),

            dateClick: (info) => {
                openDayModal(info.dateStr);
            },

            eventClick: (info) => {
                const taskId = info.event.extendedProps.taskId;
                if (taskId) Tasks.openModal(taskId);
            },

            eventDrop: (info) => {
                const taskId = info.event.extendedProps.taskId;
                const newDateStr = info.event.startStr.slice(0, 10);
                Tasks.update(taskId, { dueDate: newDateStr });
                Tasks.refreshAll();
                App.showToast('Task rescheduled to ' + formatFriendlyDate(newDateStr), 'success');
            }
        });

        calendarInstance.render();
    }

    /* ============================================
       EVENT SOURCE — built from Tasks with dueDate
       ============================================ */
    function buildEventList() {
        const tasks = Tasks.getAll().filter(t => !t.archived && t.dueDate);

        return tasks.map(t => {
            const priorityColor = Tasks.PRIORITY_CONFIG[t.priority]?.color || '#64748B';
            const isDone = t.status === 'completed';

            return {
                id: t.id,
                title: t.title,
                start: t.dueTime ? `${t.dueDate}T${t.dueTime}` : t.dueDate,
                allDay: !t.dueTime,
                backgroundColor: isDone ? '#94A3B8' : priorityColor,
                borderColor: isDone ? '#94A3B8' : priorityColor,
                textColor: '#ffffff',
                classNames: isDone ? ['fc-event-completed'] : [],
                extendedProps: { taskId: t.id }
            };
        });
    }

    function refreshEvents() {
        if (!calendarInstance) return;
        calendarInstance.removeAllEvents();
        buildEventList().forEach(evt => calendarInstance.addEvent(evt));
    }

    /* ============================================
       DAY TASKS MODAL (date click)
       ============================================ */
    function openDayModal(dateStr) {
        selectedDateStr = dateStr;
        const tasks = Tasks.getAll().filter(t => !t.archived && t.dueDate === dateStr);

        el.dayModalTitle.textContent = formatFriendlyDate(dateStr);

        if (tasks.length === 0) {
            el.dayTasksList.innerHTML = `<p style="font-size:0.85rem; color:var(--text-tertiary); text-align:center; padding:16px 0;">No tasks due on this day.</p>`;
        } else {
            el.dayTasksList.innerHTML = tasks.map(t => {
                const statusCfg = Tasks.STATUS_CONFIG[t.status];
                return `
                <div class="checklist-row" data-id="${t.id}" style="cursor:pointer;">
                    <span class="priority-dot ${t.priority}"></span>
                    <span style="flex:1;">${escapeHtml(t.title)}</span>
                    <span class="status-badge" style="--badge-color:${statusCfg.color}; font-size:0.65rem;">${statusCfg.label}</span>
                </div>`;
            }).join('');

            el.dayTasksList.querySelectorAll('[data-id]').forEach(row => {
                row.addEventListener('click', () => {
                    closeDayModal();
                    Tasks.openModal(row.dataset.id);
                });
            });
        }

        el.dayModalOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeDayModal() {
        el.dayModalOverlay.classList.remove('visible');
        document.body.style.overflow = '';
    }

    function bindDayModalEvents() {
        el.dayModalCloseBtn.addEventListener('click', closeDayModal);
        el.dayModalOverlay.addEventListener('click', (e) => {
            if (e.target === el.dayModalOverlay) closeDayModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && el.dayModalOverlay.classList.contains('visible')) closeDayModal();
        });

        el.dayTasksAddBtn.addEventListener('click', () => {
            closeDayModal();
            Tasks.openModal(null, { dueDate: selectedDateStr });
        });
    }

    /* ============================================
       UTILITIES
       ============================================ */
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatFriendlyDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }

    return { onPageShow, refreshEvents };
})();
