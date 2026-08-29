/**
 * ============================================
 * TASKS MODULE — Phase 2
 * Task CRUD, priority, status, due dates,
 * filters, search, sort, checklist, subtasks
 * ============================================
 */
const Tasks = (() => {
    /* ---- Config ---- */
    const PRIORITY_CONFIG = {
        low:    { label: 'Low',    order: 1, color: '#22C55E' },
        medium: { label: 'Medium', order: 2, color: '#F59E0B' },
        high:   { label: 'High',   order: 3, color: '#F97316' },
        urgent: { label: 'Urgent', order: 4, color: '#EF4444' }
    };

    const STATUS_CONFIG = {
        'todo':        { label: 'Todo',        color: '#64748B' },
        'in-progress': { label: 'In Progress', color: '#2563EB' },
        'waiting':     { label: 'Waiting',     color: '#A855F7' },
        'review':      { label: 'Review',      color: '#F59E0B' },
        'completed':   { label: 'Completed',   color: '#22C55E' },
        'cancelled':   { label: 'Cancelled',   color: '#94A3B8' }
    };

    /* ---- State ---- */
    let editingTaskId = null;
    let checklistDraft = [];
    let subtaskDraft = [];
    let tagsDraft = [];
    let attachmentsDraft = [];
    let showArchived = false;
    let confirmCallback = null;

    /* ---- DOM References (cached on init) ---- */
    let el = {};

    /**
     * Boot the tasks module
     */
    function init() {
        cacheDom();
        bindToolbarEvents();
        bindModalEvents();
        bindConfirmModalEvents();
        populateFilterOptions();
        renderTaskList();
        renderDashboardWidgets();
    }

    function cacheDom() {
        el = {
            taskList: document.getElementById('taskList'),
            taskEmptyState: document.getElementById('taskEmptyState'),
            taskEmptyMessage: document.getElementById('taskEmptyMessage'),
            tasksCountSubtitle: document.getElementById('tasksCountSubtitle'),

            searchInput: document.getElementById('taskSearchInput'),
            filterPriority: document.getElementById('filterPriority'),
            filterStatus: document.getElementById('filterStatus'),
            filterProject: document.getElementById('filterProject'),
            filterCategory: document.getElementById('filterCategory'),
            filterDueDate: document.getElementById('filterDueDate'),
            sortTasks: document.getElementById('sortTasks'),
            toggleArchivedBtn: document.getElementById('toggleArchivedBtn'),
            clearFiltersBtn: document.getElementById('clearFiltersBtn'),

            taskPageAddBtn: document.getElementById('taskPageAddBtn'),

            // Modal
            modalOverlay: document.getElementById('taskModalOverlay'),
            modalTitle: document.getElementById('taskModalTitle'),
            form: document.getElementById('taskForm'),
            closeBtn: document.getElementById('taskModalCloseBtn'),
            cancelBtn: document.getElementById('taskModalCancelBtn'),

            taskIdField: document.getElementById('taskId'),
            titleField: document.getElementById('taskTitle'),
            descField: document.getElementById('taskDescription'),
            projectField: document.getElementById('taskProject'),
            categoryField: document.getElementById('taskCategory'),
            priorityField: document.getElementById('taskPriority'),
            statusField: document.getElementById('taskStatus'),
            startDateField: document.getElementById('taskStartDate'),
            dueDateField: document.getElementById('taskDueDate'),
            dueTimeField: document.getElementById('taskDueTime'),
            estHoursField: document.getElementById('taskEstimatedHours'),
            actHoursField: document.getElementById('taskActualHours'),
            notesField: document.getElementById('taskNotes'),

            tagInput: document.getElementById('taskTagInput'),
            tagChips: document.getElementById('tagChips'),

            checklistInput: document.getElementById('checklistInput'),
            checklistItems: document.getElementById('checklistItems'),
            addChecklistBtn: document.getElementById('addChecklistItemBtn'),

            subtaskInput: document.getElementById('subtaskInput'),
            subtaskItems: document.getElementById('subtaskItems'),
            addSubtaskBtn: document.getElementById('addSubtaskItemBtn'),

            attachmentInput: document.getElementById('taskAttachmentInput'),
            attachmentList: document.getElementById('attachmentList'),

            projectSuggestions: document.getElementById('projectSuggestions'),

            // Confirm modal
            confirmOverlay: document.getElementById('confirmModalOverlay'),
            confirmTitle: document.getElementById('confirmTitle'),
            confirmMessage: document.getElementById('confirmMessage'),
            confirmOkBtn: document.getElementById('confirmOkBtn'),
            confirmCancelBtn: document.getElementById('confirmCancelBtn')
        };
    }

    /* ============================================
       DATA LAYER
       ============================================ */
    function getAll() {
        return Storage.get('tasks', []);
    }

    function saveAll(tasks) {
        Storage.set('tasks', tasks);
    }

    function getById(id) {
        return getAll().find(t => t.id === id);
    }

    function add(task) {
        const tasks = getAll();
        const now = new Date().toISOString();
        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            createdAt: now,
            updatedAt: now,
            completedAt: null,
            archived: false,
            ...task
        };
        tasks.unshift(newTask);
        saveAll(tasks);
        logActivity(`Created task "${newTask.title}"`, 'create');
        return newTask;
    }

    function update(id, changes) {
        const tasks = getAll();
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) return null;

        const wasCompleted = tasks[idx].status === 'completed';
        const nowCompleted = changes.status === 'completed';

        tasks[idx] = { ...tasks[idx], ...changes, updatedAt: new Date().toISOString() };

        if (!wasCompleted && nowCompleted) {
            tasks[idx].completedAt = new Date().toISOString();
            logActivity(`Completed task "${tasks[idx].title}"`, 'complete');
        } else if (wasCompleted && !nowCompleted) {
            tasks[idx].completedAt = null;
        } else {
            logActivity(`Updated task "${tasks[idx].title}"`, 'update');
        }

        saveAll(tasks);
        return tasks[idx];
    }

    function remove(id) {
        const tasks = getAll();
        const task = tasks.find(t => t.id === id);
        const filtered = tasks.filter(t => t.id !== id);
        saveAll(filtered);
        if (task) logActivity(`Deleted task "${task.title}"`, 'delete');
        return task;
    }

    function restoreDeleted(task) {
        const tasks = getAll();
        tasks.unshift(task);
        saveAll(tasks);
        logActivity(`Restored task "${task.title}"`, 'restore');
    }

    function duplicate(id) {
        const task = getById(id);
        if (!task) return null;
        const now = new Date().toISOString();
        const copy = {
            ...task,
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            title: task.title + ' (Copy)',
            status: 'todo',
            completedAt: null,
            archived: false,
            createdAt: now,
            updatedAt: now
        };
        const tasks = getAll();
        tasks.unshift(copy);
        saveAll(tasks);
        logActivity(`Duplicated task "${task.title}"`, 'duplicate');
        return copy;
    }

    function toggleArchive(id) {
        const tasks = getAll();
        const idx = tasks.findIndex(t => t.id === id);
        if (idx === -1) return;
        tasks[idx].archived = !tasks[idx].archived;
        tasks[idx].updatedAt = new Date().toISOString();
        saveAll(tasks);
        logActivity(`${tasks[idx].archived ? 'Archived' : 'Restored'} task "${tasks[idx].title}"`, 'archive');
    }

    /* ---- Activity Log ---- */
    function logActivity(message, type) {
        const activity = Storage.get('activity', []);
        activity.unshift({
            id: 'act_' + Date.now(),
            message,
            type,
            timestamp: new Date().toISOString()
        });
        // Keep only last 50 entries
        Storage.set('activity', activity.slice(0, 50));
    }

    /* ============================================
       DUE DATE / COUNTDOWN UTILITIES
       ============================================ */
    function getDaysDiff(dueDateStr) {
        if (!dueDateStr) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDateStr);
        due.setHours(0, 0, 0, 0);
        return Math.round((due - today) / (1000 * 60 * 60 * 24));
    }

    function getCountdownInfo(dueDateStr) {
        if (!dueDateStr) return { text: 'No due date', colorClass: 'due-none' };

        const days = getDaysDiff(dueDateStr);

        if (days < 0) {
            return { text: `Overdue by ${Math.abs(days)} Day${Math.abs(days) > 1 ? 's' : ''}`, colorClass: 'due-overdue' };
        }
        if (days === 0) {
            return { text: 'Today', colorClass: 'due-today' };
        }
        if (days === 1) {
            return { text: 'Tomorrow', colorClass: 'due-soon' };
        }
        if (days >= 1 && days <= 2) {
            return { text: `Due in ${days} Days`, colorClass: 'due-soon' };
        }
        if (days >= 3 && days <= 7) {
            return { text: `Due in ${days} Days`, colorClass: 'due-week' };
        }
        return { text: `Due in ${days} Days`, colorClass: 'due-later' };
    }

    /* ============================================
       FILTERING, SEARCH & SORT
       ============================================ */
    function getFilteredTasks() {
        let tasks = getAll().filter(t => !!t.archived === showArchived);

        const search = (el.searchInput?.value || '').trim().toLowerCase();
        if (search) {
            tasks = tasks.filter(t =>
                t.title.toLowerCase().includes(search) ||
                (t.description || '').toLowerCase().includes(search) ||
                (t.tags || []).some(tag => tag.toLowerCase().includes(search)) ||
                (t.project || '').toLowerCase().includes(search)
            );
        }

        const priority = el.filterPriority?.value;
        if (priority && priority !== 'all') {
            tasks = tasks.filter(t => t.priority === priority);
        }

        const status = el.filterStatus?.value;
        if (status && status !== 'all') {
            tasks = tasks.filter(t => t.status === status);
        }

        const project = el.filterProject?.value;
        if (project && project !== 'all') {
            tasks = tasks.filter(t => t.project === project);
        }

        const category = el.filterCategory?.value;
        if (category && category !== 'all') {
            tasks = tasks.filter(t => t.category === category);
        }

        const dueFilter = el.filterDueDate?.value;
        if (dueFilter && dueFilter !== 'all') {
            tasks = tasks.filter(t => {
                if (dueFilter === 'none') return !t.dueDate;
                if (!t.dueDate) return false;
                const days = getDaysDiff(t.dueDate);
                if (dueFilter === 'overdue') return days < 0;
                if (dueFilter === 'today') return days === 0;
                if (dueFilter === 'week') return days >= 0 && days <= 7;
                return true;
            });
        }

        // Sort
        const sortVal = el.sortTasks?.value || 'dueDate-asc';
        const [field, dir] = sortVal.split('-');

        tasks.sort((a, b) => {
            let cmp = 0;
            if (field === 'dueDate') {
                const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                cmp = aDate - bDate;
            } else if (field === 'priority') {
                cmp = PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order;
            } else if (field === 'createdAt') {
                cmp = new Date(a.createdAt) - new Date(b.createdAt);
            } else if (field === 'title') {
                cmp = a.title.localeCompare(b.title);
            }
            return dir === 'desc' ? -cmp : cmp;
        });

        return tasks;
    }

    /* ============================================
       RENDERING — TASK LIST
       ============================================ */
    function renderTaskList() {
        const tasks = getFilteredTasks();
        const allCount = getAll().filter(t => !t.archived).length;

        el.tasksCountSubtitle.textContent = showArchived
            ? `${tasks.length} archived task${tasks.length !== 1 ? 's' : ''}`
            : `${allCount} task${allCount !== 1 ? 's' : ''} total`;

        el.toggleArchivedBtn.classList.toggle('active', showArchived);

        if (tasks.length === 0) {
            el.taskList.innerHTML = '';
            el.taskEmptyState.style.display = 'flex';
            el.taskEmptyMessage.textContent = showArchived
                ? 'No archived tasks.'
                : (getAll().length === 0 ? 'No tasks yet. Create your first task to get started.' : 'No tasks match your filters.');
            return;
        }

        el.taskEmptyState.style.display = 'none';
        el.taskList.innerHTML = tasks.map(renderTaskCard).join('');
        bindTaskCardEvents();
    }

    function renderTaskCard(task) {
        const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
        const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
        const countdown = getCountdownInfo(task.dueDate);
        const isCompleted = task.status === 'completed';

        const checklist = task.checklist || [];
        const checklistDone = checklist.filter(c => c.done).length;
        const checklistTotal = checklist.length;

        const subtasks = task.subtasks || [];

        const tagsHtml = (task.tags || []).map(tag =>
            `<span class="mini-tag">${escapeHtml(tag)}</span>`
        ).join('');

        return `
        <div class="task-card ${isCompleted ? 'is-completed' : ''}" data-id="${task.id}">
            <button class="task-check-btn ${isCompleted ? 'checked' : ''}" data-action="toggle-complete" title="${isCompleted ? 'Mark incomplete' : 'Mark complete'}">
                ${isCompleted ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>

            <div class="task-card-body" data-action="edit">
                <div class="task-card-top">
                    <span class="priority-dot ${task.priority}" title="${priorityCfg.label} priority"></span>
                    <h4 class="task-card-title">${escapeHtml(task.title)}</h4>
                    ${task.project ? `<span class="project-chip">${escapeHtml(task.project)}</span>` : ''}
                </div>

                ${task.description ? `<p class="task-card-desc">${escapeHtml(truncate(task.description, 120))}</p>` : ''}

                <div class="task-card-meta">
                    <span class="status-badge" style="--badge-color:${statusCfg.color}">${statusCfg.label}</span>
                    ${task.dueDate ? `<span class="due-badge ${countdown.colorClass}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${countdown.text}
                    </span>` : ''}
                    ${checklistTotal > 0 ? `<span class="meta-chip"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> ${checklistDone}/${checklistTotal}</span>` : ''}
                    ${subtasks.length > 0 ? `<span class="meta-chip"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> ${subtasks.length}</span>` : ''}
                    ${task.category ? `<span class="meta-chip">${escapeHtml(task.category)}</span>` : ''}
                    ${tagsHtml}
                </div>
            </div>

            <div class="task-card-actions">
                <button class="task-action-btn" data-action="duplicate" title="Duplicate">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
                <button class="task-action-btn" data-action="archive" title="${task.archived ? 'Restore' : 'Archive'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                </button>
                <button class="task-action-btn danger" data-action="delete" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>
        </div>`;
    }

    function bindTaskCardEvents() {
        el.taskList.querySelectorAll('.task-card').forEach(card => {
            const id = card.dataset.id;

            card.querySelector('[data-action="edit"]').addEventListener('click', () => openModal(id));

            card.querySelector('[data-action="toggle-complete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                const task = getById(id);
                const newStatus = task.status === 'completed' ? 'todo' : 'completed';
                update(id, { status: newStatus });
                refreshAll();
                App.showToast(newStatus === 'completed' ? 'Task completed 🎉' : 'Task marked incomplete', 'success');
            });

            card.querySelector('[data-action="duplicate"]').addEventListener('click', (e) => {
                e.stopPropagation();
                duplicate(id);
                refreshAll();
                App.showToast('Task duplicated', 'success');
            });

            card.querySelector('[data-action="archive"]').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleArchive(id);
                refreshAll();
                App.showToast(showArchived ? 'Task restored' : 'Task archived', 'info');
            });

            card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                const task = getById(id);
                showConfirm(
                    'Delete this task?',
                    `"${task.title}" will be permanently removed.`,
                    () => {
                        const deleted = remove(id);
                        refreshAll();
                        App.showToast('Task deleted', 'error');
                        // Undo support via a follow-up toast action
                        offerUndo(deleted);
                    }
                );
            });
        });
    }

    function offerUndo(deletedTask) {
        if (!deletedTask) return;
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast warning';
        toast.innerHTML = `
            <svg class="toast-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
            <span>Task deleted</span>
            <button class="toast-undo-btn">Undo</button>
        `;
        toastContainer.appendChild(toast);

        const timer = setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 5000);

        toast.querySelector('.toast-undo-btn').addEventListener('click', () => {
            clearTimeout(timer);
            restoreDeleted(deletedTask);
            refreshAll();
            App.showToast('Task restored', 'success');
            toast.remove();
        });
    }

    /* ============================================
       FILTER OPTIONS (Project / Category dropdowns)
       ============================================ */
    function populateFilterOptions() {
        const tasks = getAll();
        const taskProjects = tasks.map(t => t.project).filter(Boolean);
        const definedProjects = (typeof Projects !== 'undefined') ? Projects.getNames() : [];
        const projects = [...new Set([...definedProjects, ...taskProjects])].sort();
        const categories = [...new Set(tasks.map(t => t.category).filter(Boolean))].sort();

        const currentProjectVal = el.filterProject.value;
        el.filterProject.innerHTML = '<option value="all">All Projects</option>' +
            projects.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
        if (projects.includes(currentProjectVal)) el.filterProject.value = currentProjectVal;

        const currentCategoryVal = el.filterCategory.value;
        el.filterCategory.innerHTML = '<option value="all">All Categories</option>' +
            categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        if (categories.includes(currentCategoryVal)) el.filterCategory.value = currentCategoryVal;

        el.projectSuggestions.innerHTML = projects.map(p => `<option value="${escapeHtml(p)}"></option>`).join('');
    }

    /* ============================================
       TOOLBAR EVENTS
       ============================================ */
    function bindToolbarEvents() {
        el.searchInput.addEventListener('input', debounce(renderTaskList, 200));
        el.filterPriority.addEventListener('change', renderTaskList);
        el.filterStatus.addEventListener('change', renderTaskList);
        el.filterProject.addEventListener('change', renderTaskList);
        el.filterCategory.addEventListener('change', renderTaskList);
        el.filterDueDate.addEventListener('change', renderTaskList);
        el.sortTasks.addEventListener('change', renderTaskList);

        el.toggleArchivedBtn.addEventListener('click', () => {
            showArchived = !showArchived;
            renderTaskList();
        });

        el.clearFiltersBtn.addEventListener('click', () => {
            el.searchInput.value = '';
            el.filterPriority.value = 'all';
            el.filterStatus.value = 'all';
            el.filterProject.value = 'all';
            el.filterCategory.value = 'all';
            el.filterDueDate.value = 'all';
            el.sortTasks.value = 'dueDate-asc';
            renderTaskList();
        });

        el.taskPageAddBtn.addEventListener('click', () => openModal());
    }

    /* ============================================
       MODAL: OPEN / CLOSE / RESET
       ============================================ */
    function openModal(taskId = null, prefill = null) {
        editingTaskId = taskId;
        el.form.reset();
        checklistDraft = [];
        subtaskDraft = [];
        tagsDraft = [];
        attachmentsDraft = [];

        if (taskId) {
            const task = getById(taskId);
            if (!task) return;

            el.modalTitle.textContent = 'Edit Task';
            el.taskIdField.value = task.id;
            el.titleField.value = task.title || '';
            el.descField.value = task.description || '';
            el.projectField.value = task.project || '';
            el.categoryField.value = task.category || '';
            el.priorityField.value = task.priority || 'medium';
            el.statusField.value = task.status || 'todo';
            el.startDateField.value = task.startDate || '';
            el.dueDateField.value = task.dueDate || '';
            el.dueTimeField.value = task.dueTime || '';
            el.estHoursField.value = task.estimatedHours || '';
            el.actHoursField.value = task.actualHours || '';
            el.notesField.value = task.notes || '';

            checklistDraft = JSON.parse(JSON.stringify(task.checklist || []));
            subtaskDraft = JSON.parse(JSON.stringify(task.subtasks || []));
            tagsDraft = [...(task.tags || [])];
            attachmentsDraft = [...(task.attachments || [])];
        } else {
            el.modalTitle.textContent = 'New Task';
            el.taskIdField.value = '';
            el.priorityField.value = Settings.getSetting('defaultPriority') || 'medium';
            el.statusField.value = 'todo';
            el.projectField.value = Settings.getSetting('defaultProject') || '';

            if (prefill) {
                if (prefill.dueDate) el.dueDateField.value = prefill.dueDate;
                if (prefill.project) el.projectField.value = prefill.project;
            }
        }

        renderChecklist();
        renderSubtasks();
        renderTags();
        renderAttachments();
        populateFilterOptions();

        el.modalOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
        setTimeout(() => el.titleField.focus(), 100);
    }

    function closeModal() {
        el.modalOverlay.classList.remove('visible');
        document.body.style.overflow = '';
        editingTaskId = null;
    }

    function bindModalEvents() {
        el.closeBtn.addEventListener('click', closeModal);
        el.cancelBtn.addEventListener('click', closeModal);
        el.modalOverlay.addEventListener('click', (e) => {
            if (e.target === el.modalOverlay) closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && el.modalOverlay.classList.contains('visible')) closeModal();
        });

        el.form.addEventListener('submit', handleFormSubmit);

        /* ---- Tags ---- */
        el.tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const val = el.tagInput.value.trim().replace(/,$/, '');
                if (val && !tagsDraft.includes(val)) {
                    tagsDraft.push(val);
                    renderTags();
                }
                el.tagInput.value = '';
            }
        });

        /* ---- Checklist ---- */
        el.addChecklistBtn.addEventListener('click', addChecklistItem);
        el.checklistInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); }
        });

        /* ---- Subtasks ---- */
        el.addSubtaskBtn.addEventListener('click', addSubtaskItem);
        el.subtaskInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addSubtaskItem(); }
        });

        /* ---- Attachments (local reference only) ---- */
        el.attachmentInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(f => {
                attachmentsDraft.push({ name: f.name, size: f.size });
            });
            renderAttachments();
            el.attachmentInput.value = '';
        });
    }

    function addChecklistItem() {
        const val = el.checklistInput.value.trim();
        if (!val) return;
        checklistDraft.push({ id: 'chk_' + Date.now() + Math.random().toString(36).slice(2, 5), text: val, done: false });
        el.checklistInput.value = '';
        renderChecklist();
    }

    function addSubtaskItem() {
        const val = el.subtaskInput.value.trim();
        if (!val) return;
        subtaskDraft.push({ id: 'sub_' + Date.now() + Math.random().toString(36).slice(2, 5), title: val, done: false });
        el.subtaskInput.value = '';
        renderSubtasks();
    }

    function renderChecklist() {
        el.checklistItems.innerHTML = checklistDraft.map((item, i) => `
            <div class="checklist-row">
                <input type="checkbox" ${item.done ? 'checked' : ''} data-idx="${i}" class="chk-toggle">
                <span class="${item.done ? 'done' : ''}">${escapeHtml(item.text)}</span>
                <button type="button" class="remove-item-btn" data-idx="${i}" data-type="chk">&times;</button>
            </div>
        `).join('');

        el.checklistItems.querySelectorAll('.chk-toggle').forEach(cb => {
            cb.addEventListener('change', (e) => {
                checklistDraft[+e.target.dataset.idx].done = e.target.checked;
                renderChecklist();
            });
        });
        el.checklistItems.querySelectorAll('[data-type="chk"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                checklistDraft.splice(+e.target.dataset.idx, 1);
                renderChecklist();
            });
        });
    }

    function renderSubtasks() {
        el.subtaskItems.innerHTML = subtaskDraft.map((item, i) => `
            <div class="checklist-row">
                <input type="checkbox" ${item.done ? 'checked' : ''} data-idx="${i}" class="sub-toggle">
                <span class="${item.done ? 'done' : ''}">${escapeHtml(item.title)}</span>
                <button type="button" class="remove-item-btn" data-idx="${i}" data-type="sub">&times;</button>
            </div>
        `).join('');

        el.subtaskItems.querySelectorAll('.sub-toggle').forEach(cb => {
            cb.addEventListener('change', (e) => {
                subtaskDraft[+e.target.dataset.idx].done = e.target.checked;
                renderSubtasks();
            });
        });
        el.subtaskItems.querySelectorAll('[data-type="sub"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                subtaskDraft.splice(+e.target.dataset.idx, 1);
                renderSubtasks();
            });
        });
    }

    function renderTags() {
        el.tagChips.innerHTML = tagsDraft.map((tag, i) => `
            <span class="tag-chip">${escapeHtml(tag)} <button type="button" data-idx="${i}">&times;</button></span>
        `).join('');

        el.tagChips.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                tagsDraft.splice(+btn.dataset.idx, 1);
                renderTags();
            });
        });
    }

    function renderAttachments() {
        if (attachmentsDraft.length === 0) {
            el.attachmentList.innerHTML = '';
            return;
        }
        el.attachmentList.innerHTML = attachmentsDraft.map((f, i) => `
            <div class="attachment-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                <span>${escapeHtml(f.name)}</span>
                <span class="attachment-size">${formatBytes(f.size)}</span>
                <button type="button" class="remove-item-btn" data-idx="${i}">&times;</button>
            </div>
        `).join('');

        el.attachmentList.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                attachmentsDraft.splice(+btn.dataset.idx, 1);
                renderAttachments();
            });
        });
    }

    /* ============================================
       FORM SUBMIT
       ============================================ */
    function handleFormSubmit(e) {
        e.preventDefault();

        const title = el.titleField.value.trim();
        if (!title) {
            App.showToast('Task title is required', 'error');
            el.titleField.focus();
            return;
        }

        const taskData = {
            title,
            description: el.descField.value.trim(),
            project: el.projectField.value.trim(),
            category: el.categoryField.value.trim(),
            priority: el.priorityField.value,
            status: el.statusField.value,
            assignedTo: 'Me',
            startDate: el.startDateField.value || null,
            dueDate: el.dueDateField.value || null,
            dueTime: el.dueTimeField.value || null,
            estimatedHours: el.estHoursField.value ? parseFloat(el.estHoursField.value) : null,
            actualHours: el.actHoursField.value ? parseFloat(el.actHoursField.value) : null,
            tags: tagsDraft,
            notes: el.notesField.value.trim(),
            checklist: checklistDraft,
            subtasks: subtaskDraft,
            attachments: attachmentsDraft
        };

        if (editingTaskId) {
            update(editingTaskId, taskData);
            App.showToast('Task updated', 'success');
        } else {
            taskData.archived = false;
            add(taskData);
            App.showToast('Task created', 'success');
        }

        closeModal();
        refreshAll();
    }

    /* ============================================
       CONFIRM MODAL (reusable)
       ============================================ */
    function showConfirm(title, message, onConfirm) {
        el.confirmTitle.textContent = title;
        el.confirmMessage.textContent = message;
        confirmCallback = onConfirm;
        el.confirmOverlay.classList.add('visible');
    }

    function bindConfirmModalEvents() {
        el.confirmOkBtn.addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
            el.confirmOverlay.classList.remove('visible');
            confirmCallback = null;
        });
        el.confirmCancelBtn.addEventListener('click', () => {
            el.confirmOverlay.classList.remove('visible');
            confirmCallback = null;
        });
        el.confirmOverlay.addEventListener('click', (e) => {
            if (e.target === el.confirmOverlay) {
                el.confirmOverlay.classList.remove('visible');
                confirmCallback = null;
            }
        });
    }

    /* ============================================
       DASHBOARD WIDGETS
       ============================================ */
    function renderDashboardWidgets() {
        renderTodayFocus();
        renderUpcomingDeadlines();
        renderRecentActivity();
    }

    function renderTodayFocus() {
        const container = document.getElementById('todayFocusList');
        const countEl = document.getElementById('todayFocusCount');
        if (!container) return;

        const tasks = getAll().filter(t => {
            if (t.archived || t.status === 'completed' || t.status === 'cancelled') return false;
            if (!t.dueDate) return false;
            return getDaysDiff(t.dueDate) === 0;
        });

        countEl.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`;

        if (tasks.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                <p>No tasks due today. Enjoy!</p>
            </div>`;
            return;
        }

        container.innerHTML = tasks.slice(0, 6).map(t => `
            <div class="focus-item" data-id="${t.id}">
                <span class="priority-dot ${t.priority}"></span>
                <span style="flex:1; font-size:0.85rem; font-weight:500;">${escapeHtml(truncate(t.title, 40))}</span>
                ${t.dueTime ? `<span style="font-size:0.75rem; color:var(--text-tertiary);">${t.dueTime}</span>` : ''}
            </div>
        `).join('');

        container.querySelectorAll('.focus-item').forEach(item => {
            item.addEventListener('click', () => {
                App.navigateTo('tasks');
                setTimeout(() => openModal(item.dataset.id), 150);
            });
        });
    }

    function renderUpcomingDeadlines() {
        const container = document.getElementById('upcomingDeadlines');
        if (!container) return;

        const tasks = getAll()
            .filter(t => {
                if (t.archived || t.status === 'completed' || t.status === 'cancelled') return false;
                if (!t.dueDate) return false;
                const days = getDaysDiff(t.dueDate);
                return days > 0 && days <= 14;
            })
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .slice(0, 6);

        if (tasks.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p>No upcoming deadlines</p>
            </div>`;
            return;
        }

        container.innerHTML = tasks.map(t => {
            const countdown = getCountdownInfo(t.dueDate);
            return `
            <div class="deadline-item" data-id="${t.id}">
                <span class="priority-dot ${t.priority}"></span>
                <span style="flex:1; font-size:0.85rem; font-weight:500;">${escapeHtml(truncate(t.title, 34))}</span>
                <span class="due-badge ${countdown.colorClass}" style="font-size:0.7rem;">${countdown.text}</span>
            </div>`;
        }).join('');

        container.querySelectorAll('.deadline-item').forEach(item => {
            item.addEventListener('click', () => {
                App.navigateTo('tasks');
                setTimeout(() => openModal(item.dataset.id), 150);
            });
        });
    }

    function renderRecentActivity() {
        const container = document.getElementById('recentActivity');
        if (!container) return;

        const activity = Storage.get('activity', []).slice(0, 8);

        if (activity.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <p>No recent activity yet</p>
            </div>`;
            return;
        }

        const typeIcons = {
            create: '➕', update: '✏️', complete: '✅', delete: '🗑️', duplicate: '📋', restore: '♻️', archive: '📦'
        };

        container.innerHTML = activity.map(a => `
            <div class="activity-item">
                <span style="font-size:1rem;">${typeIcons[a.type] || '•'}</span>
                <span style="flex:1; font-size:0.82rem;">${escapeHtml(a.message)}</span>
                <span style="font-size:0.72rem; color:var(--text-tertiary); white-space:nowrap;">${timeAgo(a.timestamp)}</span>
            </div>
        `).join('');
    }

    /* ============================================
       REFRESH EVERYTHING (after data changes)
       ============================================ */
    function refreshAll() {
        populateFilterOptions();
        renderTaskList();
        renderDashboardWidgets();
        if (typeof Projects !== 'undefined') Projects.renderProjectProgress();
        if (typeof Calendar !== 'undefined') Calendar.refreshEvents();
        if (typeof Kanban !== 'undefined') Kanban.renderBoard();
        if (typeof Charts !== 'undefined') Charts.refreshDashboardCharts();
        if (typeof App !== 'undefined' && App.updateDashboardStats) App.updateDashboardStats();
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

    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '…' : str;
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function timeAgo(isoString) {
        const seconds = Math.floor((new Date() - new Date(isoString)) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    function debounce(fn, wait) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), wait);
        };
    }

    /* ---- Public API ---- */
    return {
        init,
        getAll,
        add,
        update,
        remove,
        duplicate,
        openModal,
        closeModal,
        refreshAll,
        renderDashboardWidgets,
        populateFilterOptions,
        getCountdownInfo,
        getDaysDiff,
        PRIORITY_CONFIG,
        STATUS_CONFIG
    };
})();
