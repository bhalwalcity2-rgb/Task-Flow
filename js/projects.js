/**
 * ============================================
 * PROJECTS MODULE — Phase 3
 * Project CRUD, progress tracking
 * ============================================
 */
const Projects = (() => {
    const COLOR_PALETTE = [
        '#2563EB', '#22C55E', '#F59E0B', '#EF4444',
        '#A855F7', '#0EA5E9', '#EC4899', '#14B8A6'
    ];

    let editingProjectId = null;
    let selectedColor = COLOR_PALETTE[0];
    let el = {};

    function init() {
        cacheDom();
        renderColorSwatches();
        bindEvents();
        renderProjectsPage();
        renderProjectProgress();
    }

    function cacheDom() {
        el = {
            grid: document.getElementById('projectsGrid'),
            emptyState: document.getElementById('projectEmptyState'),
            countSubtitle: document.getElementById('projectsCountSubtitle'),
            addBtn: document.getElementById('projectAddBtn'),

            modalOverlay: document.getElementById('projectModalOverlay'),
            modalTitle: document.getElementById('projectModalTitle'),
            form: document.getElementById('projectForm'),
            closeBtn: document.getElementById('projectModalCloseBtn'),
            cancelBtn: document.getElementById('projectModalCancelBtn'),

            idField: document.getElementById('projectId'),
            nameField: document.getElementById('projectName'),
            descField: document.getElementById('projectDescription'),
            colorField: document.getElementById('projectColor'),
            colorSwatchRow: document.getElementById('colorSwatchRow'),
            deadlineField: document.getElementById('projectDeadline')
        };
    }

    /* ============================================
       DATA LAYER
       ============================================ */
    function getAll() {
        return Storage.get('projects', []);
    }

    function saveAll(projects) {
        Storage.set('projects', projects);
    }

    function getById(id) {
        return getAll().find(p => p.id === id);
    }

    function getNames() {
        return getAll().filter(p => !p.archived).map(p => p.name);
    }

    function add(project) {
        const projects = getAll();
        const now = new Date().toISOString();
        const newProject = {
            id: 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            createdAt: now,
            updatedAt: now,
            archived: false,
            ...project
        };
        projects.unshift(newProject);
        saveAll(projects);
        return newProject;
    }

    function update(id, changes) {
        const projects = getAll();
        const idx = projects.findIndex(p => p.id === id);
        if (idx === -1) return null;
        const oldName = projects[idx].name;
        projects[idx] = { ...projects[idx], ...changes, updatedAt: new Date().toISOString() };
        saveAll(projects);

        // Keep task.project strings in sync if the project was renamed
        if (changes.name && changes.name !== oldName) {
            const tasks = Tasks.getAll();
            let touched = false;
            tasks.forEach(t => {
                if (t.project === oldName) {
                    t.project = changes.name;
                    touched = true;
                }
            });
            if (touched) Storage.set('tasks', tasks);
        }
        return projects[idx];
    }

    function remove(id) {
        const projects = getAll();
        const filtered = projects.filter(p => p.id !== id);
        saveAll(filtered);
    }

    /* ============================================
       PROGRESS CALCULATION
       ============================================ */
    function getProjectStats(project) {
        const tasks = Tasks.getAll().filter(t => t.project === project.name && !t.archived);
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = tasks.filter(t => {
            if (t.status === 'completed' || t.status === 'cancelled' || !t.dueDate) return false;
            const days = Math.round((new Date(t.dueDate) - today) / 86400000);
            return days <= 7;
        }).length;

        const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { total, completed, pending, due, completionPct };
    }

    /* ============================================
       RENDERING — PROJECTS PAGE
       ============================================ */
    function renderProjectsPage() {
        const projects = getAll().filter(p => !p.archived);
        el.countSubtitle.textContent = `${projects.length} project${projects.length !== 1 ? 's' : ''}`;

        if (projects.length === 0) {
            el.grid.innerHTML = '';
            el.emptyState.style.display = 'flex';
            return;
        }

        el.emptyState.style.display = 'none';
        el.grid.innerHTML = projects.map(renderProjectCard).join('');
        bindProjectCardEvents();
    }

    function renderProjectCard(project) {
        const stats = getProjectStats(project);
        const color = project.color || '#2563EB';

        return `
        <div class="project-card" data-id="${project.id}" style="--project-color:${color}">
            <div class="project-card-top">
                <span class="project-color-dot" style="background:${color}"></span>
                <h4 class="project-card-title">${escapeHtml(project.name)}</h4>
                <div class="project-card-actions">
                    <button class="task-action-btn" data-action="edit" title="Edit">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button class="task-action-btn danger" data-action="delete" title="Delete">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </div>

            ${project.description ? `<p class="project-card-desc">${escapeHtml(truncate(project.description, 90))}</p>` : ''}

            <div class="progress-track" style="margin: 10px 0 6px;">
                <div class="progress-fill" style="width:${stats.completionPct}%; background:${color};"></div>
            </div>
            <div class="project-bar-header" style="margin-bottom: 10px;">
                <span>${stats.completionPct}% complete</span>
                <span>${stats.completed}/${stats.total} tasks</span>
            </div>

            <div class="project-stat-row">
                <div class="project-stat"><span class="project-stat-value">${stats.completed}</span><span class="project-stat-label">Completed</span></div>
                <div class="project-stat"><span class="project-stat-value">${stats.pending}</span><span class="project-stat-label">Pending</span></div>
                <div class="project-stat"><span class="project-stat-value">${stats.due}</span><span class="project-stat-label">Due Soon</span></div>
            </div>

            ${project.deadline ? `<div class="project-deadline">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Deadline: ${formatDate(project.deadline)}
            </div>` : ''}
        </div>`;
    }

    function bindProjectCardEvents() {
        el.grid.querySelectorAll('.project-card').forEach(card => {
            const id = card.dataset.id;

            card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(id);
            });

            card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                const project = getById(id);
                const stats = getProjectStats(project);
                showDeleteConfirm(project, stats);
            });

            card.addEventListener('click', () => {
                // Jump to Tasks page filtered by this project
                const project = getById(id);
                App.navigateTo('tasks');
                setTimeout(() => {
                    const filterProject = document.getElementById('filterProject');
                    if (filterProject) {
                        filterProject.value = project.name;
                        filterProject.dispatchEvent(new Event('change'));
                    }
                }, 150);
            });
        });
    }

    function showDeleteConfirm(project, stats) {
        const overlay = document.getElementById('confirmModalOverlay');
        const title = document.getElementById('confirmTitle');
        const message = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOkBtn');

        title.textContent = 'Delete this project?';
        message.textContent = stats.total > 0
            ? `"${project.name}" has ${stats.total} task(s) linked to it. The project will be deleted but tasks will remain (unassigned).`
            : `"${project.name}" will be permanently removed.`;

        overlay.classList.add('visible');

        const handler = () => {
            remove(project.id);
            refreshAll();
            App.showToast('Project deleted', 'error');
            okBtn.removeEventListener('click', handler);
        };
        okBtn.addEventListener('click', handler, { once: true });
    }

    /* ============================================
       MODAL
       ============================================ */
    function renderColorSwatches() {
        el.colorSwatchRow.innerHTML = COLOR_PALETTE.map(c => `
            <button type="button" class="color-swatch" data-color="${c}" style="background:${c}"></button>
        `).join('');

        el.colorSwatchRow.querySelectorAll('.color-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                selectedColor = sw.dataset.color;
                el.colorField.value = selectedColor;
                updateSwatchSelection();
            });
        });
        updateSwatchSelection();
    }

    function updateSwatchSelection() {
        el.colorSwatchRow.querySelectorAll('.color-swatch').forEach(sw => {
            sw.classList.toggle('selected', sw.dataset.color === selectedColor);
        });
    }

    function openModal(projectId = null) {
        editingProjectId = projectId;
        el.form.reset();

        if (projectId) {
            const project = getById(projectId);
            if (!project) return;
            el.modalTitle.textContent = 'Edit Project';
            el.idField.value = project.id;
            el.nameField.value = project.name;
            el.descField.value = project.description || '';
            el.deadlineField.value = project.deadline || '';
            selectedColor = project.color || COLOR_PALETTE[0];
        } else {
            el.modalTitle.textContent = 'New Project';
            el.idField.value = '';
            selectedColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
        }

        el.colorField.value = selectedColor;
        updateSwatchSelection();

        el.modalOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
        setTimeout(() => el.nameField.focus(), 100);
    }

    function closeModal() {
        el.modalOverlay.classList.remove('visible');
        document.body.style.overflow = '';
        editingProjectId = null;
    }

    function bindEvents() {
        el.addBtn.addEventListener('click', () => openModal());
        el.closeBtn.addEventListener('click', closeModal);
        el.cancelBtn.addEventListener('click', closeModal);
        el.modalOverlay.addEventListener('click', (e) => {
            if (e.target === el.modalOverlay) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && el.modalOverlay.classList.contains('visible')) closeModal();
        });

        el.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = el.nameField.value.trim();
            if (!name) {
                App.showToast('Project name is required', 'error');
                return;
            }

            const data = {
                name,
                description: el.descField.value.trim(),
                color: el.colorField.value,
                deadline: el.deadlineField.value || null
            };

            if (editingProjectId) {
                update(editingProjectId, data);
                App.showToast('Project updated', 'success');
            } else {
                add(data);
                App.showToast('Project created', 'success');
            }

            closeModal();
            refreshAll();
        });
    }

    /* ============================================
       DASHBOARD WIDGET
       ============================================ */
    function renderProjectProgress() {
        const container = document.getElementById('projectProgress');
        if (!container) return;

        const projects = getAll().filter(p => !p.archived);

        if (projects.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                <p>No projects yet</p>
            </div>`;
            return;
        }

        container.innerHTML = projects.slice(0, 5).map(p => {
            const stats = getProjectStats(p);
            return `
            <div class="project-bar" data-id="${p.id}" style="cursor:pointer;">
                <div class="project-bar-header">
                    <span>${escapeHtml(p.name)}</span>
                    <span>${stats.completionPct}%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width:${stats.completionPct}%; background:${p.color || '#2563EB'};"></div>
                </div>
            </div>`;
        }).join('');

        container.querySelectorAll('.project-bar').forEach(bar => {
            bar.addEventListener('click', () => App.navigateTo('projects'));
        });
    }

    /* ============================================
       REFRESH
       ============================================ */
    function refreshAll() {
        renderProjectsPage();
        renderProjectProgress();
        if (typeof Tasks !== 'undefined') Tasks.populateFilterOptions();
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

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    return {
        init,
        getAll,
        getById,
        getNames,
        add,
        update,
        remove,
        getProjectStats,
        openModal,
        closeModal,
        refreshAll,
        renderProjectProgress
    };
})();
