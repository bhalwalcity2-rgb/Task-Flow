/**
 * ============================================
 * KANBAN MODULE — Phase 4
 * Visual task board with drag-and-drop status updates
 * ============================================
 */
const Kanban = (() => {
    const COLUMNS = ['todo', 'in-progress', 'review', 'completed'];

    let sortableInstances = [];
    let initialized = false;
    let projectFilter = 'all';
    let el = {};

    /**
     * Lazily build the board the first time the Kanban page is shown.
     */
    function onPageShow() {
        cacheDom();

        if (!initialized) {
            populateProjectFilter();
            bindEvents();
            initSortable();
            initialized = true;
        } else {
            populateProjectFilter();
        }

        renderBoard();
    }

    function cacheDom() {
        el = {
            filter: document.getElementById('kanbanProjectFilter'),
            bodies: {
                'todo': document.getElementById('kanbanBody-todo'),
                'in-progress': document.getElementById('kanbanBody-in-progress'),
                'review': document.getElementById('kanbanBody-review'),
                'completed': document.getElementById('kanbanBody-completed')
            },
            counts: {
                'todo': document.getElementById('kanbanCount-todo'),
                'in-progress': document.getElementById('kanbanCount-in-progress'),
                'review': document.getElementById('kanbanCount-review'),
                'completed': document.getElementById('kanbanCount-completed')
            }
        };
    }

    function bindEvents() {
        el.filter.addEventListener('change', () => {
            projectFilter = el.filter.value;
            renderBoard();
        });
    }

    function populateProjectFilter() {
        const names = (typeof Projects !== 'undefined') ? Projects.getNames() : [];
        const taskNames = Tasks.getAll().map(t => t.project).filter(Boolean);
        const all = [...new Set([...names, ...taskNames])].sort();

        const current = el.filter.value;
        el.filter.innerHTML = '<option value="all">All Projects</option>' +
            all.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
        if (all.includes(current)) el.filter.value = current;
    }

    /* ============================================
       SORTABLE (drag-and-drop) SETUP
       ============================================ */
    function initSortable() {
        COLUMNS.forEach(status => {
            const body = el.bodies[status];
            const instance = Sortable.create(body, {
                group: 'kanban-tasks',
                animation: 180,
                ghostClass: 'kanban-ghost',
                dragClass: 'kanban-dragging',
                onAdd: (evt) => {
                    const taskId = evt.item.dataset.id;
                    const newStatus = evt.to.dataset.status;
                    Tasks.update(taskId, { status: newStatus });
                    Tasks.refreshAll();
                    App.showToast(`Moved to ${Tasks.STATUS_CONFIG[newStatus].label}`, 'success');
                    renderBoard(); // re-render to refresh counts/badges cleanly
                }
            });
            sortableInstances.push(instance);
        });
    }

    /* ============================================
       RENDERING
       ============================================ */
    function renderBoard() {
        if (!el.bodies) return; // Kanban page hasn't been shown yet — nothing to render into

        const allTasks = Tasks.getAll().filter(t => !t.archived);
        const filtered = projectFilter === 'all'
            ? allTasks
            : allTasks.filter(t => t.project === projectFilter);

        COLUMNS.forEach(status => {
            const tasks = filtered.filter(t => t.status === status);
            el.counts[status].textContent = tasks.length;
            el.bodies[status].innerHTML = tasks.map(renderCard).join('');
        });

        bindCardEvents();
    }

    function renderCard(task) {
        const countdown = task.dueDate ? Tasks.getCountdownInfo(task.dueDate) : null;
        const checklist = task.checklist || [];
        const checklistDone = checklist.filter(c => c.done).length;

        return `
        <div class="kanban-card" data-id="${task.id}">
            <div class="kanban-card-top">
                <span class="priority-dot ${task.priority}"></span>
                ${task.project ? `<span class="project-chip">${escapeHtml(task.project)}</span>` : ''}
            </div>
            <p class="kanban-card-title">${escapeHtml(task.title)}</p>
            <div class="kanban-card-meta">
                ${countdown ? `<span class="due-badge ${countdown.colorClass}">${countdown.text}</span>` : ''}
                ${checklist.length > 0 ? `<span class="meta-chip">${checklistDone}/${checklist.length}</span>` : ''}
            </div>
        </div>`;
    }

    function bindCardEvents() {
        Object.values(el.bodies).forEach(body => {
            body.querySelectorAll('.kanban-card').forEach(card => {
                card.addEventListener('click', () => {
                    Tasks.openModal(card.dataset.id);
                });
            });
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

    return { onPageShow, renderBoard };
})();
