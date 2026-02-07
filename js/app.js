// =================================================================================
// MARKETING HUB - MAIN APPLICATION
// Versão 2.0 Refatorada
// =================================================================================

import { CONFIG, DOM_CACHE, initDOMCache, PAGE_IDS } from './config.js';
import { state, applyFilter, clearFilters, getFilteredTasks, resetState, addTaskToState, updateTaskInState, removeTaskFromState, invalidateFilterCache } from './state.js';
import { debounce, showToast, toggleButtonLoading, formatLogDate, generatePastelColor, getContrastColor, escapeHtml, safeExecute } from './utils.js';
import * as API from './api.js';
import * as UI from './ui.js';

// =================================================================================
// EDITOR INSTANCES (carregados sob demanda)
// =================================================================================
let quillEditor = null;
let ideaQuillEditor = null;
let currentEditorTab = 'ideia';
let editorContents = { ideia: null, roteiro: null, script: null, inspiracoes: null };
let confirmCallback = null;
let currentModalTagIds = new Set();

// =================================================================================
// THEME MANAGEMENT
// =================================================================================
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (systemPrefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    updateThemeIcons();

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            updateThemeIcons();
        }
    });
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons();
}

function updateThemeIcons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const darkIcon = document.querySelector('.theme-icon-dark');
    const lightIcon = document.querySelector('.theme-icon-light');

    if (darkIcon && lightIcon) {
        darkIcon.classList.toggle('hidden', isDark);
        lightIcon.classList.toggle('hidden', !isDark);
    }

    // Update toggle button background for dark mode
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        if (isDark) {
            toggleBtn.classList.remove('bg-slate-200', 'text-slate-600', 'hover:bg-slate-300');
            toggleBtn.classList.add('bg-slate-700', 'text-yellow-300', 'hover:bg-slate-600');
        } else {
            toggleBtn.classList.remove('bg-slate-700', 'text-yellow-300', 'hover:bg-slate-600');
            toggleBtn.classList.add('bg-slate-200', 'text-slate-600', 'hover:bg-slate-300');
        }
    }
}

// =================================================================================
// MODAL MANAGEMENT
// =================================================================================
const modals = {};

function initModals() {
    modals['task-modal'] = document.getElementById('task-modal');
    modals['tags-modal'] = document.getElementById('tags-modal');
    modals['contract-modal'] = document.getElementById('contract-modal');
    modals['generate-tasks-modal'] = document.getElementById('generate-tasks-modal');
    modals['confirm-modal'] = document.getElementById('confirm-modal');
    modals['image-preview-modal'] = document.getElementById('image-preview-modal');
}

function showModal(modalId) {
    const modal = modals[modalId];
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const modalBox = modal.querySelector('.modal-enter');
    if (modalBox) {
        requestAnimationFrame(() => modalBox.classList.add('modal-enter-active'));
    }
}

function hideModal(modalId) {
    const modal = modals[modalId];
    if (!modal) return;

    const modalBox = modal.querySelector('.modal-enter');
    if (modalBox) {
        modalBox.classList.remove('modal-enter-active');
    }

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

function showConfirmModal(title, text, onConfirm) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-text').textContent = text;
    confirmCallback = onConfirm;
    showModal('confirm-modal');
}

// =================================================================================
// PAGE CONFIGURATION
// =================================================================================
const pageConfigs = {
    [PAGE_IDS.DASHBOARD]: {
        loader: () => UI.renderDashboard(DOM_CACHE.dashboardPage),
        actions: ''
    },
    [PAGE_IDS.CLIENTS]: {
        loader: () => UI.renderClientsTable(DOM_CACHE.clientsPage),
        actions: ''
    },
    [PAGE_IDS.IDEAS]: {
        loader: initializeIdeasPage,
        actions: ''
    },
    [PAGE_IDS.KANBAN]: {
        loader: () => {
            UI.renderKanbanBoard(DOM_CACHE.kanbanBoard);
            initializeDragAndDrop();
        },
        actions: `<button id="add-task-btn" class="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-full flex items-center transition-colors"><i class="fas fa-plus mr-2"></i> Nova Tarefa</button>`
    },
    [PAGE_IDS.CALENDAR]: {
        loader: renderCalendar,
        actions: `
            <div class="flex items-center gap-4">
                <button id="generate-tasks-btn" class="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-full flex items-center transition-colors">
                    <i class="fas fa-magic mr-2"></i> Gerar Tarefas
                </button>
                <div class="flex items-center border border-gray-200 rounded-full p-1 bg-slate-100">
                    <button data-view="month" class="calendar-view-btn px-3 py-1 rounded-full text-sm font-semibold bg-white shadow-sm text-emerald-600">Mês</button>
                    <button data-view="week" class="calendar-view-btn px-3 py-1 rounded-full text-sm font-semibold text-gray-500">Semana</button>
                </div>
                <div class="flex items-center gap-2">
                    <button id="prev-btn" class="w-10 h-10 flex items-center justify-center border rounded-full bg-white text-gray-700 hover:bg-gray-100"><i class="fas fa-chevron-left"></i></button>
                    <span id="current-date-display" class="font-bold text-lg text-gray-700 w-48 text-center"></span>
                    <button id="next-btn" class="w-10 h-10 flex items-center justify-center border rounded-full bg-white text-gray-700 hover:bg-gray-100"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>`
    }
};

// =================================================================================
// PAGE NAVIGATION
// =================================================================================
async function showPage(pageId) {
    if (!pageConfigs[pageId]) return;
    state.currentPage = pageId;

    // Atualiza navegação
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const isActive = btn.dataset.page === pageId;
        btn.classList.toggle('bg-white', isActive);
        btn.classList.toggle('shadow-sm', isActive);
        btn.classList.toggle('text-emerald-600', isActive);
        btn.classList.toggle('text-gray-500', !isActive);
        btn.classList.toggle('hover:text-gray-800', !isActive);
    });

    // Mostra página
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.getElementById(`${pageId}-page`).classList.remove('hidden');

    // Atualiza ações do header
    DOM_CACHE.headerActions.innerHTML = pageConfigs[pageId].actions;

    // Mostra/esconde barra de filtros
    if (pageId === PAGE_IDS.KANBAN || pageId === PAGE_IDS.CALENDAR) {
        UI.populateFilters();
        DOM_CACHE.filterBar.classList.remove('hidden');
    } else {
        DOM_CACHE.filterBar.classList.add('hidden');
    }

    // Carrega página
    await safeExecute(
        () => pageConfigs[pageId].loader(),
        `carregar página ${pageId}`
    );
}

// =================================================================================
// CALENDAR
// =================================================================================
function renderCalendar() {
    const calendarPage = DOM_CACHE.calendarPage;
    const display = document.getElementById('current-date-display');
    const filteredTasks = getFilteredTasks();

    if (state.calendarView === 'month') {
        UI.renderMonthView(calendarPage, display, filteredTasks);
    } else {
        UI.renderWeekView(calendarPage, display, filteredTasks);
    }
}

function navigateCalendar(direction) {
    if (state.calendarView === 'month') {
        state.currentDate.setMonth(state.currentDate.getMonth() + direction);
    } else {
        state.currentDate.setDate(state.currentDate.getDate() + (7 * direction));
    }
    renderCalendar();
}

function setCalendarView(view) {
    state.calendarView = view;
    document.querySelectorAll('.calendar-view-btn').forEach(btn => {
        const isActive = btn.dataset.view === view;
        btn.classList.toggle('bg-white', isActive);
        btn.classList.toggle('shadow-sm', isActive);
        btn.classList.toggle('text-emerald-600', isActive);
        btn.classList.toggle('text-gray-500', !isActive);
    });
    renderCalendar();
}

// =================================================================================
// IDEAS PAGE
// =================================================================================
async function initializeIdeasPage() {
    UI.renderIdeasPage(DOM_CACHE.ideasPage);

    // Inicializa Quill sob demanda
    if (!ideaQuillEditor) {
        ideaQuillEditor = new Quill('#idea-editor-quill', {
            theme: 'snow',
            placeholder: 'Comece a escrever...'
        });
    }

    try {
        // Busca ideias apenas do usuário atual
        state.ideas = await API.fetchIdeas(state.currentUser.auth_id);
    } catch (error) {
        API.handleSupabaseError(error, 'buscar ideias');
    }

    UI.renderIdeasSidebar();
    UI.renderIdeaContent(ideaQuillEditor);
}

function selectIdea(ideaId) {
    state.activeIdeaId = ideaId;
    UI.renderIdeasSidebar();
    UI.renderIdeaContent(ideaQuillEditor);
}

async function createNewIdea() {
    try {
        // Usa auth_id (UUID) para criar ideia, não o id interno da tabela mkt_users
        const newIdea = await API.createIdea(state.currentUser.auth_id);
        state.ideas.unshift(newIdea);
        selectIdea(newIdea.id);
    } catch (error) {
        API.handleSupabaseError(error, 'criar nova ideia');
    }
}

async function saveActiveIdea() {
    if (!state.activeIdeaId) return;

    const saveBtn = document.getElementById('save-idea-btn');
    toggleButtonLoading(saveBtn, true);

    try {
        const title = document.getElementById('idea-title-input').value;
        const content = ideaQuillEditor.getContents();

        await API.updateIdea(state.activeIdeaId, { title, content });
        showToast('Ideia salva com sucesso!', 'success');

        const ideaInState = state.ideas.find(i => i.id === state.activeIdeaId);
        if (ideaInState) {
            ideaInState.title = title;
            ideaInState.content = content;
            UI.renderIdeasSidebar();
        }
    } catch (error) {
        API.handleSupabaseError(error, 'salvar ideia');
    } finally {
        toggleButtonLoading(saveBtn, false);
    }
}

async function deleteIdea(ideaId) {
    if (!ideaId) return;

    showConfirmModal('Excluir Ideia?', 'Tem certeza que deseja excluir esta ideia? Esta ação é irreversível.', async () => {
        try {
            await API.deleteIdea(ideaId);
            state.ideas = state.ideas.filter(i => i.id !== ideaId);

            if (state.activeIdeaId === ideaId) {
                state.activeIdeaId = null;
            }

            UI.renderIdeasSidebar();
            UI.renderIdeaContent(ideaQuillEditor);
            showToast('Ideia excluída com sucesso.');
        } catch (error) {
            API.handleSupabaseError(error, 'deletar ideia');
        }
    });
}

// =================================================================================
// DRAG AND DROP
// =================================================================================
function initializeDragAndDrop() {
    document.querySelectorAll('.kanban-cards').forEach(column => {
        new Sortable(column, {
            group: 'kanban',
            animation: 150,
            onEnd: async (evt) => {
                const { item, to } = evt;
                const taskId = parseInt(item.dataset.taskId);
                const newStatusId = parseInt(to.dataset.columnId);
                const task = state.tasks.find(t => t.id === taskId);

                if (task && task.status_id !== newStatusId) {
                    const oldStatus = state.status.find(s => s.id === task.status_id)?.name;
                    const newStatus = state.status.find(s => s.id === newStatusId)?.name;

                    // Optimistic update
                    updateTaskInState(taskId, { status_id: newStatusId });

                    try {
                        await API.createLog(taskId, state.currentUser.id, `Status alterado de "${oldStatus}" para "${newStatus}".`);
                        await API.updateTaskStatus(taskId, newStatusId);
                    } catch (error) {
                        API.handleSupabaseError(error, 'atualizar status da tarefa');
                        refreshCurrentView();
                    }
                }
            }
        });
    });
}

// =================================================================================
// TASK MODAL
// =================================================================================
async function openTaskModal(taskId = null) {
    const form = document.getElementById('task-form');
    form.reset();

    currentModalTagIds.clear();
    editorContents = { ideia: null, roteiro: null, script: null, inspiracoes: null };

    // Reset editor tabs
    document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.editor-tab[data-tab="ideia"]')?.classList.add('active');
    currentEditorTab = 'ideia';

    if (quillEditor) quillEditor.setContents('', 'silent');

    const quillContainer = document.querySelector('#quill-editor-container .ql-container');
    if (quillContainer) {
        quillContainer.className = 'ql-container ql-snow bg-ideia';
    }

    // Popula selects
    const statusSelect = document.getElementById('task-status');
    statusSelect.innerHTML = state.status.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

    const channelSelect = document.getElementById('task-channel');
    channelSelect.innerHTML = state.channels.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    const assigneeSelect = document.getElementById('task-assignee');
    assigneeSelect.innerHTML = '<option value="">Ninguém</option>' + state.users.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');

    const clientSelect = document.getElementById('task-client');
    clientSelect.innerHTML = '<option value="">Selecione um Cliente</option>' + state.clients.map(c => `<option value="${c.id_cliente}">${escapeHtml(c.nome_empresa)}</option>`).join('');

    const modalTitle = document.getElementById('modal-title');
    const deleteBtn = document.getElementById('delete-task-btn');
    const taskIdInput = document.getElementById('task-id');
    const logsContainer = document.getElementById('task-logs-container');
    const fileContainer = document.getElementById('file-list-container');
    const dropZone = document.getElementById('drop-zone');

    if (taskId) {
        const task = state.tasks.find(t => t.id == taskId);
        if (!task) {
            showToast("Erro: Tarefa não encontrada.", 'error');
            return;
        }

        modalTitle.textContent = `Editar: ${task.title}`;
        deleteBtn.classList.remove('hidden');
        taskIdInput.value = task.id;
        dropZone.classList.remove('pointer-events-none', 'opacity-50');

        document.getElementById('task-title').value = task.title;
        statusSelect.value = task.status_id;
        channelSelect.value = task.channel_id;
        clientSelect.value = task.client_id || '';
        assigneeSelect.value = task.assignee_id || '';
        document.getElementById('task-due-date').value = task.due_date;

        if (task.description_data && quillEditor) {
            editorContents = { ...editorContents, ...task.description_data };
            quillEditor.setContents(editorContents[currentEditorTab] || '', 'silent');
        }

        const taskTagIds = state.taskTags.filter(tt => tt.task_id === taskId).map(tt => tt.tag_id);
        taskTagIds.forEach(id => currentModalTagIds.add(id));

        renderTaskFiles(taskId);
        renderTaskTags();

        // Carrega logs
        const logs = await API.getTaskLogs(taskId);
        if (logs && logs.length > 0) {
            logsContainer.innerHTML = logs.map(log => `
                <div class="text-xs pb-2 border-b last:border-b-0">
                    <p class="text-gray-700">${escapeHtml(log.description)}</p>
                    <p class="text-gray-400 mt-1">${log.mkt_users?.name || 'Sistema'} - ${formatLogDate(log.created_at)}</p>
                </div>
            `).join('');
        } else {
            logsContainer.innerHTML = '<p class="text-sm text-gray-500">Nenhum histórico.</p>';
        }
    } else {
        modalTitle.textContent = 'Nova Tarefa';
        deleteBtn.classList.add('hidden');
        taskIdInput.value = '';
        dropZone.classList.add('pointer-events-none', 'opacity-50');

        document.getElementById('task-tags-container').innerHTML = '';
        fileContainer.innerHTML = '<p class="text-xs text-center text-slate-400">Salve a tarefa para adicionar anexos.</p>';
        logsContainer.innerHTML = '<p class="text-sm text-gray-500">Nenhum histórico.</p>';
        renderTaskTags();
    }

    showModal('task-modal');
}

function renderTaskFiles(taskId) {
    const container = document.getElementById('file-list-container');
    const filesForTask = state.taskFiles.filter(f => f.task_id === Number(taskId));

    if (filesForTask.length === 0) {
        container.innerHTML = '<p class="text-xs text-center text-slate-400">Nenhum anexo nesta tarefa.</p>';
        return;
    }

    container.innerHTML = filesForTask.map(file => {
        const publicUrl = API.getFilePublicUrl(file.file_path);
        const isImage = /\.(jpe?g|png|gif|webp)$/i.test(file.file_name);

        return `
            <div class="file-item group flex items-center justify-between p-2 hover:bg-slate-100 rounded-md">
                <div class="flex items-center gap-3 truncate">
                    ${isImage ? `<img src="${publicUrl}" class="w-8 h-8 object-cover rounded-sm" loading="lazy">` : '<i class="fas fa-file-alt text-2xl text-slate-400 w-8 text-center"></i>'}
                    <span class="text-sm font-medium text-slate-700 truncate">${escapeHtml(file.file_name)}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" class="view-file-btn text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full" data-file-url="${publicUrl}" data-is-image="${isImage}">Ver</button>
                    <button type="button" class="delete-file-btn text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" data-file-id="${file.id}" data-file-path="${file.file_path}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>`;
    }).join('');
}

function renderTaskTags() {
    const container = document.getElementById('task-tags-container');
    const dropdown = document.getElementById('tag-select-dropdown');

    const taskTagIds = Array.from(currentModalTagIds);
    const assignedTags = state.tags.filter(t => taskTagIds.includes(t.id));
    const availableTags = state.tags.filter(t => !taskTagIds.includes(t.id));

    container.innerHTML = assignedTags.map(tag => {
        const color = tag.color || generatePastelColor(tag.name);
        return `
            <div class="tag-pill-active flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded" style="background-color:${color}; color: ${getContrastColor(color)}" data-tag-id="${tag.id}">
                <span>${escapeHtml(tag.name)}</span>
                <button type="button" class="remove-tag-btn text-current hover:opacity-75">&times;</button>
            </div>`;
    }).join('');

    dropdown.innerHTML = availableTags.map(tag =>
        `<a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-slate-100" data-tag-id="${tag.id}">${escapeHtml(tag.name)}</a>`
    ).join('');
}

async function saveTask(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('save-task-btn');
    toggleButtonLoading(saveBtn, true);

    try {
        const id = document.getElementById('task-id').value;
        const newStatusId = parseInt(document.getElementById('task-status').value);
        editorContents[currentEditorTab] = quillEditor.getContents();

        const taskData = {
            title: document.getElementById('task-title').value,
            status_id: newStatusId,
            channel_id: document.getElementById('task-channel').value,
            client_id: document.getElementById('task-client').value || null,
            assignee_id: document.getElementById('task-assignee').value || null,
            due_date: document.getElementById('task-due-date').value || null,
            description_data: editorContents
        };

        let savedData;
        let oldStatus, newStatus;

        if (id) {
            const currentTask = state.tasks.find(t => t.id == id);
            if (currentTask && currentTask.status_id !== newStatusId) {
                oldStatus = state.status.find(s => s.id === currentTask.status_id)?.name;
                newStatus = state.status.find(s => s.id === newStatusId)?.name;
            }
            savedData = await API.updateTask(id, taskData);
        } else {
            taskData.status_id = newStatusId || state.status[0]?.id;
            if (!taskData.status_id) throw new Error('Não foi possível encontrar um status inicial.');
            savedData = await API.createTask(taskData);
            newStatus = state.status.find(s => s.id === taskData.status_id)?.name;
        }

        if (savedData) {
            if (id) {
                if (oldStatus && newStatus) {
                    await API.createLog(savedData.id, state.currentUser.id, `Status alterado de "${oldStatus}" para "${newStatus}".`);
                }
                updateTaskInState(savedData.id, savedData);
            } else {
                await API.createLog(savedData.id, state.currentUser.id, `Tarefa criada no status "${newStatus}".`);
                addTaskToState(savedData);
            }

            await saveTaskTags(savedData.id);
            refreshCurrentView();
            hideModal('task-modal');
            showToast(`Tarefa ${id ? 'atualizada' : 'criada'} com sucesso!`, 'success');
        }
    } catch (error) {
        API.handleSupabaseError(error, 'salvar tarefa');
    } finally {
        toggleButtonLoading(saveBtn, false);
    }
}

async function deleteTask() {
    const id = document.getElementById('task-id').value;
    if (!id) return;

    showConfirmModal('Excluir Tarefa?', 'Esta ação é irreversível.', async () => {
        try {
            const filesToDelete = state.taskFiles.filter(f => f.task_id == id);
            if (filesToDelete.length > 0) {
                const filePaths = filesToDelete.map(f => f.file_path);
                await API.supabaseClient.storage.from(CONFIG.STORAGE_BUCKET).remove(filePaths);
            }

            await API.deleteTask(id);
            removeTaskFromState(id);
            refreshCurrentView();
            hideModal('task-modal');
            showToast("Tarefa excluída com sucesso.");
        } catch (error) {
            API.handleSupabaseError(error, 'excluir tarefa');
        }
    });
}

async function saveTaskTags(taskId) {
    const selectedTagIds = Array.from(currentModalTagIds);
    const existingTagRelations = state.taskTags.filter(tt => tt.task_id === taskId);
    const existingTagIds = existingTagRelations.map(tt => tt.tag_id);

    await API.saveTaskTags(taskId, selectedTagIds, existingTagIds);

    // Atualiza estado local
    state.taskTags = state.taskTags.filter(tt => tt.task_id !== taskId);
    selectedTagIds.forEach(tag_id => {
        state.taskTags.push({ task_id: taskId, tag_id });
    });
}

// =================================================================================
// FILE HANDLING
// =================================================================================
async function handleFileUpload(files, taskId) {
    const dropZone = document.getElementById('drop-zone');
    const dropZoneContent = document.getElementById('drop-zone-content');
    const originalContent = dropZoneContent.innerHTML;

    dropZone.classList.add('pointer-events-none');
    dropZoneContent.innerHTML = `<i class="fas fa-spinner fa-spin text-2xl text-slate-400"></i><p class="mt-1 text-sm text-slate-600">Enviando ${files.length} arquivo(s)...</p>`;

    const uploadPromises = Array.from(files).map(file =>
        API.uploadFile(taskId, state.currentUser.id, file).catch(error => {
            API.handleSupabaseError(error, `upload de ${file.name}`);
            return null;
        })
    );

    const newFiles = await Promise.all(uploadPromises);

    dropZone.classList.remove('pointer-events-none');
    dropZoneContent.innerHTML = originalContent;
    document.getElementById('task-file-input').value = '';

    const successfulUploads = newFiles.filter(f => f !== null);
    if (successfulUploads.length > 0) {
        state.taskFiles.push(...successfulUploads);
        renderTaskFiles(taskId);
        showToast(`${successfulUploads.length} arquivo(s) enviado(s) com sucesso!`, 'success');
    }
}

async function deleteFile(fileId, filePath) {
    showConfirmModal('Excluir Anexo?', 'Tem certeza que deseja excluir este arquivo?', async () => {
        try {
            await API.deleteFile(fileId, filePath);
            state.taskFiles = state.taskFiles.filter(f => f.id !== fileId);
            const taskId = document.getElementById('task-id').value;
            renderTaskFiles(taskId);
            showToast('Anexo excluído com sucesso.');
        } catch (error) {
            API.handleSupabaseError(error, 'deletar arquivo');
        }
    });
}

// =================================================================================
// TAGS MANAGEMENT
// =================================================================================
async function openTagsModal() {
    await loadTagsInModal();
    showModal('tags-modal');
}

async function loadTagsInModal() {
    const container = document.getElementById('tags-list-container');
    container.innerHTML = state.tags.map(tag => `
        <div class="flex justify-between items-center p-3 hover:bg-slate-100 rounded-lg">
            <div class="flex items-center gap-3">
                <span class="w-4 h-4 rounded-full" style="background-color: ${tag.color || generatePastelColor(tag.name)};"></span>
                <span class="font-medium text-gray-700">${escapeHtml(tag.name)}</span>
            </div>
            <button class="delete-tag-btn text-gray-400 hover:text-red-500" data-id="${tag.id}"><i class="fas fa-trash-alt"></i></button>
        </div>
    `).join('');
}

async function addTag() {
    const addBtn = document.getElementById('add-new-tag-btn');
    const nameInput = document.getElementById('new-tag-name');
    const name = nameInput.value.trim();

    if (!name) {
        showToast('Por favor, insira um nome para a tag.');
        return;
    }

    toggleButtonLoading(addBtn, true);

    try {
        const newTag = await API.createTag(name, generatePastelColor(name));
        if (newTag) {
            state.tags.push(newTag);
            nameInput.value = '';
            await loadTagsInModal();
            showToast('Tag adicionada com sucesso!', 'success');
        }
    } catch (error) {
        API.handleSupabaseError(error, 'adicionar tag');
    } finally {
        toggleButtonLoading(addBtn, false);
    }
}

async function deleteTag(tagId) {
    showConfirmModal('Excluir Tag?', 'A tag será removida de todas as tarefas.', async () => {
        try {
            await API.deleteTag(tagId);
            state.tags = state.tags.filter(t => t.id !== parseInt(tagId));
            state.taskTags = state.taskTags.filter(tt => tt.tag_id !== parseInt(tagId));
            invalidateFilterCache();
            showToast('Tag removida com sucesso!');
            await loadTagsInModal();
        } catch (error) {
            API.handleSupabaseError(error, 'excluir tag');
        }
    });
}

// =================================================================================
// CONTRACT MODAL
// =================================================================================
function openContractModal(clientId) {
    const client = state.clients.find(c => c.id_cliente === clientId);
    if (!client) {
        showToast('Cliente não encontrado.');
        return;
    }

    document.getElementById('contract-client-id').value = client.id_cliente;
    document.getElementById('contract-client-name').textContent = client.nome_empresa;
    document.getElementById('client-posts').value = client.postagens_mensais || 0;
    document.getElementById('client-stories').value = client.storys_mensais || 0;
    document.getElementById('client-offline').checked = client.demanda_offline || false;

    showModal('contract-modal');
}

async function saveContract(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('save-contract-btn');
    toggleButtonLoading(saveBtn, true);

    try {
        const clientId = document.getElementById('contract-client-id').value;
        const contractData = {
            postagens_mensais: parseInt(document.getElementById('client-posts').value) || 0,
            storys_mensais: parseInt(document.getElementById('client-stories').value) || 0,
            demanda_offline: document.getElementById('client-offline').checked,
        };

        const updatedClient = await API.updateClientContract(clientId, contractData);

        const index = state.clients.findIndex(c => c.id_cliente === clientId);
        if (index > -1) {
            state.clients[index] = { ...state.clients[index], ...updatedClient };
        }

        UI.renderClientsTable(DOM_CACHE.clientsPage);
        hideModal('contract-modal');
        showToast('Contrato atualizado com sucesso!', 'success');
    } catch (error) {
        API.handleSupabaseError(error, 'salvar contrato');
    } finally {
        toggleButtonLoading(saveBtn, false);
    }
}

// =================================================================================
// GENERATE TASKS MODAL
// =================================================================================
function openGenerateTasksModal() {
    const modalBody = document.getElementById('generate-tasks-body');
    const monthName = state.currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    document.getElementById('generate-tasks-month').textContent = monthName;

    modalBody.innerHTML = '';

    state.clients.forEach(client => {
        const totalTasks = (client.postagens_mensais || 0) + (client.storys_mensais || 0);
        if (totalTasks === 0) return;

        modalBody.insertAdjacentHTML('beforeend', `
            <div class="p-4 border rounded-lg bg-white">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <input id="client-checkbox-${client.id_cliente}" type="checkbox" data-client-id="${client.id_cliente}" class="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 client-selector">
                        <label for="client-checkbox-${client.id_cliente}" class="ml-3 block text-lg font-bold text-gray-900 cursor-pointer">${escapeHtml(client.nome_empresa)} <span class="text-sm font-normal text-gray-500">(${totalTasks} tarefas)</span></label>
                    </div>
                </div>
                <div id="task-inputs-${client.id_cliente}" class="hidden mt-4 pt-4 border-t space-y-4"></div>
            </div>
        `);
    });

    // Event listeners para checkboxes
    modalBody.querySelectorAll('.client-selector').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const clientId = e.target.dataset.clientId;
            const container = document.getElementById(`task-inputs-${clientId}`);
            if (e.target.checked) {
                renderTaskInputsForClient(clientId, container);
            } else {
                container.innerHTML = '';
                container.classList.add('hidden');
            }
        });
    });

    showModal('generate-tasks-modal');
}

function renderTaskInputsForClient(clientId, container) {
    const client = state.clients.find(c => c.id_cliente === clientId);
    if (!client) return;

    container.innerHTML = '';
    let inputsHtml = '<div class="space-y-3">';

    for (let i = 1; i <= (client.postagens_mensais || 0); i++) {
        inputsHtml += createTaskInputRow({ type: 'Post', number: i });
    }

    for (let i = 1; i <= (client.storys_mensais || 0); i++) {
        inputsHtml += createTaskInputRow({ type: 'Story', number: i });
    }

    inputsHtml += '</div>';
    inputsHtml += `<button type="button" class="add-extra-task-btn mt-4 text-sm font-semibold text-emerald-600 hover:text-emerald-800" data-client-id="${clientId}"><i class="fas fa-plus mr-2"></i>Adicionar Tarefa Extra</button>`;

    container.innerHTML = inputsHtml;
    container.classList.remove('hidden');
}

function createTaskInputRow({ type, number }) {
    const usersOptions = state.users.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
    const channelsOptions = state.channels.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    const instagramChannel = state.channels.find(c => c.name.toLowerCase() === 'instagram');

    return `
        <div class="p-3 bg-slate-50 rounded-lg border grid grid-cols-1 md:grid-cols-4 gap-4 items-start generated-task-row">
            <input type="text" value="${type} ${number}" placeholder="Título da Tarefa" class="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-400 task-title-input" required>
            <input type="date" class="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-400 task-date-input" required>
            <select class="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-400 task-assignee-input"><option value="">Responsável...</option>${usersOptions}</select>
            <select class="w-full p-2 border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-400 task-channel-input">${channelsOptions}</select>
        </div>
    `;
}

async function handleGenerateTasks(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('execute-generate-tasks-btn');
    toggleButtonLoading(submitBtn, true);

    try {
        const tasksToCreate = [];
        const firstStatusId = state.status[0]?.id;

        document.querySelectorAll('.client-selector:checked').forEach(checkbox => {
            const clientId = checkbox.dataset.clientId;
            const container = document.getElementById(`task-inputs-${clientId}`);

            container.querySelectorAll('.generated-task-row').forEach(row => {
                const title = row.querySelector('.task-title-input')?.value;
                const dueDate = row.querySelector('.task-date-input')?.value;
                const assigneeId = row.querySelector('.task-assignee-input')?.value;
                const channelId = row.querySelector('.task-channel-input')?.value;

                if (title && dueDate) {
                    tasksToCreate.push({
                        title,
                        due_date: dueDate,
                        client_id: clientId,
                        assignee_id: assigneeId || null,
                        channel_id: channelId || null,
                        status_id: firstStatusId,
                        description_data: {}
                    });
                }
            });
        });

        if (tasksToCreate.length === 0) {
            showToast('Nenhuma tarefa válida para criar.');
            return;
        }

        const createdTasks = await API.createTasksBulk(tasksToCreate);
        state.tasks.push(...createdTasks);
        invalidateFilterCache();

        hideModal('generate-tasks-modal');
        refreshCurrentView();
        showToast(`${createdTasks.length} tarefa(s) criada(s) com sucesso!`, 'success');
    } catch (error) {
        API.handleSupabaseError(error, 'gerar tarefas');
    } finally {
        toggleButtonLoading(submitBtn, false);
    }
}

// =================================================================================
// QUILL EDITOR SETUP
// =================================================================================
function setupQuillEditors() {
    quillEditor = new Quill('#quill-editor', { theme: 'snow' });

    document.querySelectorAll('.editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            if (!quillEditor) return;

            editorContents[currentEditorTab] = quillEditor.getContents();
            document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            currentEditorTab = tab.dataset.tab;
            quillEditor.setContents(editorContents[currentEditorTab] || '', 'silent');

            const quillContainer = document.querySelector('#quill-editor-container .ql-container');
            quillContainer.classList.remove('bg-ideia', 'bg-roteiro', 'bg-script', 'bg-inspiracoes');
            quillContainer.classList.add(`bg-${currentEditorTab}`);
        });
    });

    // File upload setup
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('task-file-input');

    fileInput.addEventListener('change', () => {
        const taskId = document.getElementById('task-id').value;
        if (taskId) handleFileUpload(fileInput.files, Number(taskId));
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'));
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'));
    });

    dropZone.addEventListener('drop', (e) => {
        const taskId = document.getElementById('task-id').value;
        if (taskId) handleFileUpload(e.dataTransfer.files, Number(taskId));
    });
}

// =================================================================================
// REFRESH VIEW
// =================================================================================
function refreshCurrentView() {
    switch (state.currentPage) {
        case PAGE_IDS.KANBAN:
            UI.renderKanbanBoard(DOM_CACHE.kanbanBoard);
            initializeDragAndDrop();
            break;
        case PAGE_IDS.CALENDAR:
            renderCalendar();
            break;
        case PAGE_IDS.CLIENTS:
            UI.renderClientsTable(DOM_CACHE.clientsPage);
            break;
        case PAGE_IDS.DASHBOARD:
            UI.renderDashboard(DOM_CACHE.dashboardPage);
            break;
    }
}

// =================================================================================
// EVENT LISTENERS (com debounce)
// =================================================================================
const debouncedApplyFilter = debounce((key, value) => {
    applyFilter(key, value);
    refreshCurrentView();
}, CONFIG.DEBOUNCE_DELAY);

function initializeEventListeners() {
    // Delegação global de eventos
    document.body.addEventListener('click', async (e) => {
        // Task card clicks
        const card = e.target.closest('.kanban-card, .calendar-task-item, .urgent-task-item');
        if (card && card.dataset.taskId) {
            e.preventDefault();
            openTaskModal(Number(card.dataset.taskId));
            return;
        }

        // Modal overlay clicks
        const modalOverlay = e.target.closest('.fixed.inset-0');
        if (modalOverlay && (e.target === modalOverlay || e.target.closest('.btn-cancel'))) {
            e.preventDefault();
            hideModal(modalOverlay.id);
            return;
        }

        // Confirm modal buttons
        if (e.target.closest('#confirm-modal-ok')) {
            if (confirmCallback) confirmCallback();
            confirmCallback = null;
            hideModal('confirm-modal');
            return;
        }
        if (e.target.closest('#confirm-modal-cancel')) {
            confirmCallback = null;
            hideModal('confirm-modal');
            return;
        }

        // View file button
        const viewFileBtn = e.target.closest('.view-file-btn');
        if (viewFileBtn) {
            e.preventDefault();
            const url = viewFileBtn.dataset.fileUrl;
            const isImage = viewFileBtn.dataset.isImage === 'true';

            if (isImage) {
                document.getElementById('image-preview-content').src = url;
                showModal('image-preview-modal');
            } else {
                window.open(url, '_blank');
            }
            return;
        }

        // Tag dropdown
        if (e.target.closest('#add-tag-btn')) {
            document.getElementById('tag-select-dropdown').classList.toggle('hidden');
            return;
        }

        const tagOption = e.target.closest('#tag-select-dropdown a');
        if (tagOption) {
            e.preventDefault();
            currentModalTagIds.add(Number(tagOption.dataset.tagId));
            renderTaskTags();
            document.getElementById('tag-select-dropdown').classList.add('hidden');
            return;
        }

        const removeTagBtn = e.target.closest('#task-tags-container .remove-tag-btn');
        if (removeTagBtn) {
            currentModalTagIds.delete(Number(removeTagBtn.closest('.tag-pill-active').dataset.tagId));
            renderTaskTags();
            return;
        }

        // Navigation
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn) {
            showPage(navBtn.dataset.page);
            return;
        }

        // Add task button
        if (e.target.closest('#add-task-btn')) {
            openTaskModal();
            return;
        }

        // Edit contract button
        const editContractBtn = e.target.closest('.edit-contract-btn');
        if (editContractBtn) {
            openContractModal(editContractBtn.dataset.clientId);
            return;
        }

        // Generate tasks button
        if (e.target.closest('#generate-tasks-btn')) {
            openGenerateTasksModal();
            return;
        }

        // Calendar navigation
        if (e.target.closest('#prev-btn')) {
            navigateCalendar(-1);
            return;
        }
        if (e.target.closest('#next-btn')) {
            navigateCalendar(1);
            return;
        }

        const calendarViewBtn = e.target.closest('.calendar-view-btn');
        if (calendarViewBtn) {
            setCalendarView(calendarViewBtn.dataset.view);
            return;
        }

        // User menu
        const userMenuBtn = e.target.closest('#user-menu-btn');
        if (userMenuBtn) {
            DOM_CACHE.logoutPopup.classList.toggle('hidden');
            return;
        }

        if (!DOM_CACHE.logoutPopup.classList.contains('hidden') && !e.target.closest('#logout-popup')) {
            DOM_CACHE.logoutPopup.classList.add('hidden');
        }

        if (e.target.closest('#settings-btn')) {
            e.preventDefault();
            DOM_CACHE.logoutPopup.classList.add('hidden');
            openTagsModal();
            return;
        }

        if (e.target.closest('#logout-btn')) {
            e.preventDefault();
            await handleLogout();
            return;
        }

        // Ideas page
        if (e.target.closest('#add-new-idea-btn')) {
            createNewIdea();
            return;
        }

        const ideaItem = e.target.closest('.sidebar-item');
        if (ideaItem && ideaItem.dataset.ideaId) {
            selectIdea(Number(ideaItem.dataset.ideaId));
            return;
        }

        if (e.target.closest('#save-idea-btn')) {
            saveActiveIdea();
            return;
        }

        if (e.target.closest('#delete-idea-btn')) {
            deleteIdea(state.activeIdeaId);
            return;
        }

        // Clear filters
        if (e.target.closest('#clear-filters-btn')) {
            clearFilters();
            UI.populateFilters();
            refreshCurrentView();
            return;
        }

        // Delete tag in tags modal
        const deleteTagBtn = e.target.closest('#tags-modal .delete-tag-btn');
        if (deleteTagBtn) {
            deleteTag(deleteTagBtn.dataset.id);
            return;
        }

        // Add extra task in generate modal
        const addExtraBtn = e.target.closest('.add-extra-task-btn');
        if (addExtraBtn) {
            const clientId = addExtraBtn.dataset.clientId;
            const container = document.getElementById(`task-inputs-${clientId}`);
            const taskList = container.querySelector('.space-y-3');
            taskList.insertAdjacentHTML('beforeend', createTaskInputRow({ type: 'Extra', number: '' }));
            return;
        }
    });

    // Form submissions
    document.getElementById('task-form').addEventListener('submit', saveTask);
    document.getElementById('contract-form').addEventListener('submit', saveContract);
    document.getElementById('generate-tasks-form').addEventListener('submit', handleGenerateTasks);
    document.getElementById('delete-task-btn').addEventListener('click', deleteTask);
    document.getElementById('add-new-tag-btn').addEventListener('click', addTag);

    // File deletion in modal
    document.getElementById('file-list-container').addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-file-btn');
        if (deleteButton) {
            deleteFile(Number(deleteButton.dataset.fileId), deleteButton.dataset.filePath);
        }
    });

    // Filters with debounce
    document.getElementById('client-filter').addEventListener('change', (e) => debouncedApplyFilter('clientId', e.target.value));
    document.getElementById('user-filter').addEventListener('change', (e) => debouncedApplyFilter('userId', e.target.value));
    document.getElementById('channel-filter').addEventListener('change', (e) => debouncedApplyFilter('channelId', e.target.value));
    document.getElementById('tag-filter').addEventListener('change', (e) => debouncedApplyFilter('tagId', e.target.value));

    // Dashboard period filter (delegated)
    document.addEventListener('change', (e) => {
        if (e.target.id === 'dashboard-period-filter') {
            state.dashboardFilters.period = e.target.value;
            UI.renderDashboard(DOM_CACHE.dashboardPage);
        }
    });

    // Theme Toggle
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
    initializeTheme();
}

// =================================================================================
// AUTHENTICATION
// =================================================================================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');
    const submitButton = e.target.querySelector('button[type="submit"]');

    toggleButtonLoading(submitButton, true);
    errorDiv.classList.add('hidden');

    try {
        await API.signIn(email, password);
    } catch (error) {
        errorDiv.textContent = 'E-mail ou senha inválidos.';
        errorDiv.classList.remove('hidden');
    } finally {
        toggleButtonLoading(submitButton, false);
    }
}

async function handleLogout() {
    try {
        await API.signOut();
    } catch (error) {
        API.handleSupabaseError(error, 'logout');
    }
}

async function processAuthentication(session) {
    if (!session || !session.user) {
        console.warn("Sessão inválida encontrada no processAuthentication");
        return;
    }

    if (state.currentUser && state.currentUser.email === session.user.email && state.isAppInitialized) {
        // Garante que auth_id está sempre disponível (pode não estar após reload)
        if (!state.currentUser.auth_id) {
            state.currentUser.auth_id = session.user.id;
        }
        return;
    }

    try {
        let profileData = await API.getUserProfile(session.user.email);

        if (!profileData) {
            profileData = await API.upsertUserProfile({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata.full_name || session.user.email.split('@')[0],
                photo_url: session.user.user_metadata.avatar_url
            });
        }

        // Adiciona o auth_id (UUID do Supabase Auth) ao perfil do usuário
        // para uso em tabelas que referenciam auth.users (como mkt_ideas)
        state.currentUser = { ...profileData, auth_id: session.user.id };

        if (!state.isAppInitialized) {
            await initializeApp();
        }

        setupUserMenu();
        DOM_CACHE.appContainer.classList.remove('hidden');
        DOM_CACHE.loginScreen.classList.add('hidden');
        await showPage(PAGE_IDS.DASHBOARD);
    } catch (error) {
        showToast("Falha ao carregar perfil de usuário.");
        await handleLogout();
    }
}

function showLoginScreen() {
    DOM_CACHE.appContainer.classList.add('hidden');
    DOM_CACHE.loginScreen.classList.remove('hidden');
    DOM_CACHE.loginForm?.reset();

    const errorDiv = document.getElementById('login-error');
    if (errorDiv) errorDiv.classList.add('hidden');
}

function resetApplication() {
    resetState();
    API.removeAllRealtimeListeners();
    showLoginScreen();
}

function setupUserMenu() {
    const user = state.currentUser;
    if (!user) return;

    if (user.photo_url) {
        DOM_CACHE.userMenuBtn.innerHTML = `<img src="${user.photo_url}" class="w-full h-full object-cover">`;
    } else {
        DOM_CACHE.userMenuBtn.textContent = user.name.charAt(0).toUpperCase();
    }

    document.getElementById('popup-user-name').textContent = user.name;
    document.getElementById('popup-user-role').textContent = user.role || '';
}

// =================================================================================
// REALTIME HANDLERS
// =================================================================================
function handleRealtimeTaskChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
        case 'INSERT':
            if (!state.tasks.find(t => t.id === newRecord.id)) {
                addTaskToState(newRecord);
                refreshCurrentView();
            }
            break;
        case 'UPDATE':
            updateTaskInState(newRecord.id, newRecord);
            refreshCurrentView();
            break;
        case 'DELETE':
            removeTaskFromState(oldRecord.id);
            refreshCurrentView();
            break;
    }
}

function handleRealtimeFileChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
        case 'INSERT':
            if (!state.taskFiles.find(f => f.id === newRecord.id)) {
                state.taskFiles.push(newRecord);
            }
            break;
        case 'DELETE':
            state.taskFiles = state.taskFiles.filter(f => f.id !== oldRecord.id);
            break;
    }
}

function handleRealtimeTagsChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    switch (eventType) {
        case 'INSERT':
            if (!state.taskTags.find(tt => tt.task_id === newRecord.task_id && tt.tag_id === newRecord.tag_id)) {
                state.taskTags.push(newRecord);
                invalidateFilterCache();
                refreshCurrentView();
            }
            break;
        case 'DELETE':
            state.taskTags = state.taskTags.filter(tt =>
                !(tt.task_id === oldRecord.task_id && tt.tag_id === oldRecord.tag_id)
            );
            invalidateFilterCache();
            refreshCurrentView();
            break;
    }
}

// =================================================================================
// INITIALIZATION
// =================================================================================
async function initializeApp() {
    if (state.isAppInitialized) return;

    const globalData = await API.fetchGlobalData();
    Object.assign(state, globalData);

    initializeEventListeners();
    setupQuillEditors();

    API.initializeRealtimeListeners(
        handleRealtimeTaskChange,
        handleRealtimeFileChange,
        handleRealtimeTagsChange
    );

    state.isAppInitialized = true;
}

async function mainAppFlow() {
    initDOMCache();
    initModals();

    const session = await API.getSession();

    if (session) {
        await processAuthentication(session);
    } else {
        showLoginScreen();
    }

    if (state.authStateSubscription) {
        state.authStateSubscription.unsubscribe();
    }

    const { data: { subscription } } = API.onAuthStateChange(async (event, session) => {
        console.log("Auth State Changed:", event);

        switch (event) {
            case 'SIGNED_IN':
                await processAuthentication(session);
                break;
            case 'SIGNED_OUT':
                resetApplication();
                break;
            case 'TOKEN_REFRESHED':
                console.log('Token refreshed');
                break;
        }
    });

    state.authStateSubscription = subscription;
}

// =================================================================================
// START APPLICATION
// =================================================================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    mainAppFlow();
});
