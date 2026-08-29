/**
 * ============================================
 * NOTES MODULE — Phase 3
 * Quick notes, ideas, meeting notes, pinned, search
 * ============================================
 */
const Notes = (() => {
    const TYPE_CONFIG = {
        note:    { label: 'Quick Note',    color: '#2563EB' },
        idea:    { label: 'Idea',          color: '#F59E0B' },
        meeting: { label: 'Meeting Note',  color: '#A855F7' }
    };

    let editingNoteId = null;
    let el = {};

    function init() {
        cacheDom();
        bindToolbarEvents();
        bindModalEvents();
        renderNotesPage();
    }

    function cacheDom() {
        el = {
            grid: document.getElementById('notesGrid'),
            emptyState: document.getElementById('noteEmptyState'),
            countSubtitle: document.getElementById('notesCountSubtitle'),
            addBtn: document.getElementById('noteAddBtn'),
            searchInput: document.getElementById('noteSearchInput'),
            filterType: document.getElementById('filterNoteType'),

            modalOverlay: document.getElementById('noteModalOverlay'),
            modalTitle: document.getElementById('noteModalTitle'),
            form: document.getElementById('noteForm'),
            closeBtn: document.getElementById('noteModalCloseBtn'),
            cancelBtn: document.getElementById('noteModalCancelBtn'),

            idField: document.getElementById('noteId'),
            titleField: document.getElementById('noteTitle'),
            typeField: document.getElementById('noteType'),
            pinnedField: document.getElementById('notePinned'),
            contentField: document.getElementById('noteContent')
        };
    }

    /* ============================================
       DATA LAYER
       ============================================ */
    function getAll() {
        return Storage.get('notes', []);
    }

    function saveAll(notes) {
        Storage.set('notes', notes);
    }

    function getById(id) {
        return getAll().find(n => n.id === id);
    }

    function add(note) {
        const notes = getAll();
        const now = new Date().toISOString();
        const newNote = {
            id: 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            createdAt: now,
            updatedAt: now,
            pinned: false,
            ...note
        };
        notes.unshift(newNote);
        saveAll(notes);
        return newNote;
    }

    function update(id, changes) {
        const notes = getAll();
        const idx = notes.findIndex(n => n.id === id);
        if (idx === -1) return null;
        notes[idx] = { ...notes[idx], ...changes, updatedAt: new Date().toISOString() };
        saveAll(notes);
        return notes[idx];
    }

    function remove(id) {
        const notes = getAll().filter(n => n.id !== id);
        saveAll(notes);
    }

    function togglePin(id) {
        const notes = getAll();
        const idx = notes.findIndex(n => n.id === id);
        if (idx === -1) return;
        notes[idx].pinned = !notes[idx].pinned;
        notes[idx].updatedAt = new Date().toISOString();
        saveAll(notes);
    }

    /* ============================================
       FILTERING / SEARCH
       ============================================ */
    function getFilteredNotes() {
        let notes = getAll();

        const search = (el.searchInput?.value || '').trim().toLowerCase();
        if (search) {
            notes = notes.filter(n =>
                n.title.toLowerCase().includes(search) ||
                (n.content || '').toLowerCase().includes(search)
            );
        }

        const type = el.filterType?.value;
        if (type && type !== 'all') {
            notes = notes.filter(n => n.type === type);
        }

        // Pinned first, then most recently updated
        notes.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        return notes;
    }

    /* ============================================
       RENDERING
       ============================================ */
    function renderNotesPage() {
        const notes = getFilteredNotes();
        const total = getAll().length;
        el.countSubtitle.textContent = `${total} note${total !== 1 ? 's' : ''}`;

        if (notes.length === 0) {
            el.grid.innerHTML = '';
            el.emptyState.style.display = 'flex';
            return;
        }

        el.emptyState.style.display = 'none';
        el.grid.innerHTML = notes.map(renderNoteCard).join('');
        bindNoteCardEvents();
    }

    function renderNoteCard(note) {
        const typeCfg = TYPE_CONFIG[note.type] || TYPE_CONFIG.note;
        return `
        <div class="note-card ${note.pinned ? 'pinned' : ''}" data-id="${note.id}">
            <div class="note-card-top">
                <span class="mini-tag" style="color:${typeCfg.color}; background:${typeCfg.color}1A;">${typeCfg.label}</span>
                <button class="note-pin-btn ${note.pinned ? 'active' : ''}" data-action="pin" title="${note.pinned ? 'Unpin' : 'Pin'}">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="${note.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 8 3.5 3.5a1 1 0 01-.7 1.7H7.2a1 1 0 01-.7-1.7L10 11z"/></svg>
                </button>
            </div>
            <h4 class="note-card-title" data-action="edit">${escapeHtml(note.title)}</h4>
            <p class="note-card-content" data-action="edit">${escapeHtml(truncate(note.content || '', 140))}</p>
            <div class="note-card-footer">
                <span>${timeAgo(note.updatedAt)}</span>
                <button class="task-action-btn danger" data-action="delete" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>
        </div>`;
    }

    function bindNoteCardEvents() {
        el.grid.querySelectorAll('.note-card').forEach(card => {
            const id = card.dataset.id;

            card.querySelectorAll('[data-action="edit"]').forEach(target => {
                target.addEventListener('click', () => openModal(id));
            });

            card.querySelector('[data-action="pin"]').addEventListener('click', (e) => {
                e.stopPropagation();
                togglePin(id);
                renderNotesPage();
            });

            card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                e.stopPropagation();
                const note = getById(id);
                showConfirm(note);
            });
        });
    }

    function showConfirm(note) {
        const overlay = document.getElementById('confirmModalOverlay');
        const title = document.getElementById('confirmTitle');
        const message = document.getElementById('confirmMessage');
        const okBtn = document.getElementById('confirmOkBtn');

        title.textContent = 'Delete this note?';
        message.textContent = `"${note.title}" will be permanently removed.`;
        overlay.classList.add('visible');

        const handler = () => {
            remove(note.id);
            renderNotesPage();
            App.showToast('Note deleted', 'error');
            okBtn.removeEventListener('click', handler);
        };
        okBtn.addEventListener('click', handler, { once: true });
    }

    /* ============================================
       TOOLBAR
       ============================================ */
    function bindToolbarEvents() {
        el.searchInput.addEventListener('input', debounce(renderNotesPage, 200));
        el.filterType.addEventListener('change', renderNotesPage);
        el.addBtn.addEventListener('click', () => openModal());
    }

    /* ============================================
       MODAL
       ============================================ */
    function openModal(noteId = null) {
        editingNoteId = noteId;
        el.form.reset();

        if (noteId) {
            const note = getById(noteId);
            if (!note) return;
            el.modalTitle.textContent = 'Edit Note';
            el.idField.value = note.id;
            el.titleField.value = note.title;
            el.typeField.value = note.type || 'note';
            el.pinnedField.checked = !!note.pinned;
            el.contentField.value = note.content || '';
        } else {
            el.modalTitle.textContent = 'New Note';
            el.idField.value = '';
            el.typeField.value = 'note';
            el.pinnedField.checked = false;
        }

        el.modalOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
        setTimeout(() => el.titleField.focus(), 100);
    }

    function closeModal() {
        el.modalOverlay.classList.remove('visible');
        document.body.style.overflow = '';
        editingNoteId = null;
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

        el.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = el.titleField.value.trim();
            if (!title) {
                App.showToast('Note title is required', 'error');
                return;
            }

            const data = {
                title,
                type: el.typeField.value,
                pinned: el.pinnedField.checked,
                content: el.contentField.value.trim()
            };

            if (editingNoteId) {
                update(editingNoteId, data);
                App.showToast('Note updated', 'success');
            } else {
                add(data);
                App.showToast('Note saved', 'success');
            }

            closeModal();
            renderNotesPage();
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

    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '…' : str;
    }

    function timeAgo(isoString) {
        const seconds = Math.floor((new Date() - new Date(isoString)) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function debounce(fn, wait) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), wait);
        };
    }

    return { init, getAll, add, update, remove, openModal };
})();
