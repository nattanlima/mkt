// =================================================================================
// MARKETING HUB - UI RENDERING
// Versão 2.0 Refatorada
// =================================================================================

import { state, getFilteredTasks } from './state.js';
import { getFilePublicUrl } from './api.js';
import {
    escapeHtml,
    getContrastColor,
    generatePastelColor,
    clearChildren,
    htmlToElement
} from './utils.js';
import { STATUS_NAMES, DOM_CACHE } from './config.js';

// =================================================================================
// KANBAN RENDERING
// =================================================================================

/**
 * Cria HTML de um card de tarefa
 * @param {Object} task - Dados da tarefa
 * @returns {string}
 */
export function createTaskCardHtml(task) {
    const client = state.clients.find(c => c.id_cliente === task.client_id);
    const channel = state.channels.find(c => c.id === task.channel_id);
    const assignee = state.users.find(u => u.id === task.assignee_id);
    const dueDate = task.due_date ? new Date(task.due_date + 'T00:00:00') : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Formatação de data
    let dateClass = 'text-gray-500';
    let dateText = dueDate ? dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';

    if (dueDate) {
        if (dueDate < today) {
            dateClass = 'text-red-600 font-semibold';
        } else if (dueDate.getTime() === today.getTime()) {
            dateClass = 'text-amber-600 font-semibold';
            dateText += " (Hoje)";
        }
    }

    // Assignee avatar
    const assigneeHtml = assignee
        ? `<img src="${assignee.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(assignee.name)}&background=random`}" 
               title="${escapeHtml(assignee.name)}" 
               class="w-8 h-8 rounded-full object-cover border-2 border-white">`
        : '';

    // Tags
    const taskTagRelations = state.taskTags.filter(tt => tt.task_id === task.id);
    const taskTags = taskTagRelations.map(tt => state.tags.find(t => t.id === tt.tag_id)).filter(Boolean);

    const tagsHtml = taskTags.map(tag => {
        const color = tag.color || generatePastelColor(tag.name);
        return `<span class="text-xs font-semibold px-2 py-0.5 rounded" 
                      style="background-color:${color}; color: ${getContrastColor(color)}">${escapeHtml(tag.name)}</span>`;
    }).join('');

    // Thumbnail with loading animation
    const filesForTask = state.taskFiles.filter(f => Number(f.task_id) === Number(task.id));
    const firstImageFile = filesForTask.find(f => /\.(jpe?g|png|gif|webp)$/i.test(f.file_name));

    let fileThumbnailHtml = '';
    if (firstImageFile) {
        const publicUrl = getFilePublicUrl(firstImageFile.file_path);
        fileThumbnailHtml = `<img src="${publicUrl}" class="card-thumbnail w-full h-32 object-cover rounded-lg mb-3" loading="lazy" onload="this.classList.add('loaded')">`;
    }

    // Client
    const clientHtml = client
        ? `<div class="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500">
               <i class="fas fa-user-tie"></i>
               <span>${escapeHtml(client.nome_empresa)}</span>
           </div>`
        : '';

    return `
        <div class="kanban-card bg-white rounded-xl p-4 mb-4 border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all duration-200" data-task-id="${task.id}">
            ${fileThumbnailHtml}
            ${clientHtml}
            <div class="flex flex-wrap gap-2 mb-2">${tagsHtml}</div>
            <h3 class="font-bold text-gray-800 text-base leading-tight mb-3">${escapeHtml(task.title)}</h3>
            <div class="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-sm">
                <div class="flex items-center gap-2 ${dateClass}">
                    ${dueDate ? `<i class="far fa-calendar-alt opacity-70"></i> <span>${dateText}</span>` : '<span>Sem prazo</span>'}
                </div>
                <div class="flex items-center -space-x-2">
                    ${channel ? `<span class="text-xs font-semibold px-2 h-8 flex items-center bg-slate-200 text-slate-600 rounded-full">${escapeHtml(channel.name)}</span>` : ''}
                    ${assigneeHtml}
                </div>
            </div>
        </div>`;
}

/**
 * Renderiza o quadro Kanban
 * @param {HTMLElement} container - Container do Kanban
 */
export function renderKanbanBoard(container) {
    if (!container) return;

    const filteredTasks = getFilteredTasks();
    clearChildren(container);

    state.status.forEach(stat => {
        const tasksInColumn = filteredTasks
            .filter(task => task.status_id === stat.id)
            .sort((a, b) => {
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date) - new Date(b.due_date);
            });

        const column = htmlToElement(`
            <div class="kanban-column bg-slate-100 rounded-xl p-4 w-80 md:w-96 flex-shrink-0" data-status-id="${stat.id}">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="font-bold text-lg text-gray-700">${escapeHtml(stat.name)}</h2>
                    <span class="bg-slate-200 text-slate-600 text-sm font-semibold rounded-full px-2.5 py-0.5">${tasksInColumn.length}</span>
                </div>
                <div class="kanban-cards min-h-[100px] -mr-2 pr-2" data-column-id="${stat.id}">
                    ${tasksInColumn.map(task => createTaskCardHtml(task)).join('')}
                </div>
            </div>
        `);

        container.appendChild(column);
    });
}

/**
 * Atualiza um card específico no Kanban (update parcial)
 * @param {number} taskId - ID da tarefa
 */
export function updateKanbanCard(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    const existingCard = document.querySelector(`[data-task-id="${taskId}"]`);
    if (existingCard) {
        const newCard = htmlToElement(createTaskCardHtml(task));
        existingCard.replaceWith(newCard);
    }
}

// =================================================================================
// CALENDAR RENDERING
// =================================================================================

/**
 * Cria HTML de uma tarefa no calendário
 * @param {Object} task - Dados da tarefa
 * @returns {string}
 */
export function createCalendarTaskHtml(task) {
    const channel = state.channels.find(c => c.id === task.channel_id);
    const client = state.clients.find(c => c.id_cliente === task.client_id);
    const status = state.status.find(s => s.id === task.status_id);

    let colorClasses = 'bg-slate-100 text-slate-800 hover:bg-slate-200';

    if (status) {
        const statusName = status.name.toLowerCase();
        if (statusName.includes(STATUS_NAMES.TODO)) {
            colorClasses = 'bg-red-100 text-red-800 hover:bg-red-200';
        } else if (statusName.includes(STATUS_NAMES.IN_PROGRESS)) {
            colorClasses = 'bg-amber-100 text-amber-800 hover:bg-amber-200';
        } else if (statusName.includes(STATUS_NAMES.APPROVED)) {
            colorClasses = 'bg-blue-100 text-blue-800 hover:bg-blue-200';
        } else if (statusName.includes(STATUS_NAMES.DONE)) {
            colorClasses = 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200';
        }
    }

    const clientHtml = client
        ? `<span class="font-bold truncate">${escapeHtml(client.nome_empresa)}</span>`
        : `<span class="font-bold truncate">Cliente não definido</span>`;

    return `
        <div class="calendar-task-item ${colorClasses} text-xs p-1.5 rounded mt-1 cursor-pointer" data-task-id="${task.id}">
            <div class="truncate">${clientHtml}</div>
            <div class="font-semibold truncate">${escapeHtml(task.title)}</div>
            <div class="flex items-center justify-between mt-1">
                <span class="text-[10px] px-1.5 py-0.5 bg-white/60 text-current rounded-full">${channel ? escapeHtml(channel.name) : 'N/A'}</span>
            </div>
        </div>
    `;
}

/**
 * Renderiza visão mensal do calendário
 * @param {HTMLElement} container - Container do calendário
 * @param {HTMLElement} display - Elemento de display da data
 * @param {Array} tasks - Lista de tarefas filtradas
 */
export function renderMonthView(container, display, tasks) {
    const month = state.currentDate.getMonth();
    const year = state.currentDate.getFullYear();

    if (display) {
        display.textContent = `${state.currentDate.toLocaleString('pt-BR', { month: 'long' })} ${year}`;
    }

    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border h-full flex flex-col">
            <div class="grid grid-cols-7 text-center font-semibold text-gray-500 border-b">
                ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => `<div class="p-4">${day}</div>`).join('')}
            </div>
            <div id="calendar-grid" class="grid grid-cols-7 grid-rows-5 flex-grow"></div>
        </div>`;

    const calendarGrid = document.getElementById('calendar-grid');
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Dias vazios antes do mês
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarGrid.insertAdjacentHTML('beforeend', `<div class="border-b border-r bg-slate-50"></div>`);
    }

    // Dias do mês
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const dayDate = new Date(year, month, day);
        const isToday = dayDate.toDateString() === today.toDateString();

        const dayTasks = tasks.filter(t =>
            t.due_date && new Date(t.due_date + 'T00:00:00').toDateString() === dayDate.toDateString()
        );

        const dayNumberClass = isToday
            ? "font-semibold bg-emerald-500 text-white rounded-full w-7 h-7 flex items-center justify-center"
            : "font-semibold";

        const dayHtml = isToday
            ? `<div class="flex justify-end"><div class="${dayNumberClass}">${day}</div></div>`
            : `<div class="text-right ${dayNumberClass}">${day}</div>`;

        calendarGrid.insertAdjacentHTML('beforeend', `
            <div class="calendar-day border-b border-r p-2 relative">
                ${dayHtml}
                <div class="space-y-1">${dayTasks.map(task => createCalendarTaskHtml(task)).join('')}</div>
            </div>
        `);
    }
}

/**
 * Renderiza visão semanal do calendário
 * @param {HTMLElement} container - Container do calendário
 * @param {HTMLElement} display - Elemento de display da data
 * @param {Array} tasks - Lista de tarefas filtradas
 */
export function renderWeekView(container, display, tasks) {
    const startOfWeek = new Date(state.currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    if (display) {
        display.textContent = `${startOfWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${endOfWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }

    const days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        return date;
    });

    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border h-full flex flex-col">
            <div class="grid grid-cols-7 text-center font-semibold text-gray-500 border-b">
                ${days.map(d => `<div class="p-4">${d.toLocaleDateString('pt-BR', { weekday: 'short' })} <span class="font-bold">${d.getDate()}</span></div>`).join('')}
            </div>
            <div id="calendar-grid" class="grid grid-cols-7 flex-grow">
                ${days.map(day => `
                    <div class="border-r p-2">
                        ${tasks.filter(t => t.due_date && new Date(t.due_date + 'T00:00:00').toDateString() === day.toDateString())
            .map(task => createCalendarTaskHtml(task)).join('')}
                    </div>
                `).join('')}
            </div>
        </div>`;
}

// =================================================================================
// DASHBOARD RENDERING
// =================================================================================

/**
 * Renderiza o dashboard
 * @param {HTMLElement} container - Container do dashboard
 */
export function renderDashboard(container) {
    if (!container) return;

    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const periodFilter = document.getElementById('dashboard-period-filter');
    const period = periodFilter?.value || state.dashboardFilters.period;

    switch (period) {
        case 'last_7_days':
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date();
            break;
        case 'last_30_days':
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            endDate = new Date();
            break;
    }

    const tasksInPeriod = state.tasks.filter(task => {
        const taskDate = new Date(task.created_at);
        return taskDate >= startDate && taskDate <= endDate;
    });

    const concluidoStatus = state.status.find(s => s.name.toLowerCase() === STATUS_NAMES.DONE);
    const concluidoStatusId = concluidoStatus ? concluidoStatus.id : -1;

    const aFazerStatus = state.status.find(s => s.name.toLowerCase() === STATUS_NAMES.TODO);
    const emProgressoStatus = state.status.find(s => s.name.toLowerCase() === STATUS_NAMES.IN_PROGRESS);
    const activeStatusIds = [aFazerStatus?.id, emProgressoStatus?.id].filter(Boolean);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(today.getDate() + 5);

    // Tarefas urgentes
    const urgentTasks = state.tasks.filter(task => {
        if (!task.due_date || !activeStatusIds.includes(task.status_id)) return false;
        const dueDate = new Date(task.due_date + 'T00:00:00');
        return dueDate < today || (dueDate >= today && dueDate <= fiveDaysFromNow);
    }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    const urgentTasksHtml = urgentTasks.length > 0 ? urgentTasks.map(task => {
        const client = state.clients.find(c => c.id_cliente === task.client_id);
        const channel = state.channels.find(c => c.id === task.channel_id);
        const assignee = state.users.find(u => u.id === task.assignee_id);
        const dueDate = new Date(task.due_date + 'T00:00:00');
        const isOverdue = dueDate < today;

        return `
            <li class="urgent-task-item p-3 flex items-center justify-between hover:bg-red-100/50 rounded-lg cursor-pointer" data-task-id="${task.id}">
                <div class="flex items-center gap-3 overflow-hidden">
                    ${assignee
                ? `<img src="${assignee.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(assignee.name)}&background=random`}" class="w-8 h-8 rounded-full object-cover flex-shrink-0">`
                : `<div class="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0"></div>`
            }
                    <div class="truncate">
                        <p class="font-bold text-slate-800 truncate">${escapeHtml(task.title)}</p>
                        <p class="text-xs text-slate-500 truncate">${client?.nome_empresa || 'Cliente não definido'} | ${channel?.name || 'Canal não definido'}</p>
                    </div>
                </div>
                <span class="text-sm font-bold flex-shrink-0 ml-2 ${isOverdue ? 'text-red-600' : 'text-amber-600'}">${dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
            </li>
        `;
    }).join('') : '<p class="text-center text-slate-500 p-4">Nenhuma tarefa urgente.</p>';

    // Tarefas não concluídas
    const nonCompletedTasks = tasksInPeriod.filter(t => t.status_id !== concluidoStatusId);

    // Tarefas por responsável
    const tasksByAssignee = state.users.map(u => ({
        ...u,
        count: nonCompletedTasks.filter(t => t.assignee_id === u.id).length
    }));

    const tasksByAssigneeHtml = tasksByAssignee.map(user => `
        <div class="w-full">
            <div class="flex justify-between items-center text-sm font-medium text-slate-600 mb-1">
                <div class="flex items-center gap-2">
                   <img src="${user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}" class="w-5 h-5 rounded-full object-cover">
                   <span>${escapeHtml(user.name)}</span>
                </div>
                <span>${user.count} ${user.count !== 1 ? 'tarefas' : 'tarefa'}</span>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-2.5">
                <div class="bg-indigo-500 h-2.5 rounded-full" style="width: ${nonCompletedTasks.length > 0 ? (user.count / nonCompletedTasks.length) * 100 : 0}%"></div>
            </div>
        </div>
    `).join('');

    // Tarefas por status
    const tasksByStatus = state.status.map(s => ({
        name: s.name,
        count: tasksInPeriod.filter(t => t.status_id === s.id).length
    }));

    container.innerHTML = `
        <div class="flex justify-end mb-4">
            <select id="dashboard-period-filter" class="filter-select bg-white border-slate-300 rounded-full text-sm py-1.5 pl-3 pr-8 focus:ring-emerald-500 focus:border-emerald-500">
                <option value="this_month" ${period === 'this_month' ? 'selected' : ''}>Este Mês</option>
                <option value="last_7_days" ${period === 'last_7_days' ? 'selected' : ''}>Últimos 7 dias</option>
                <option value="last_30_days" ${period === 'last_30_days' ? 'selected' : ''}>Últimos 30 dias</option>
            </select>
        </div>
        <div class="space-y-6">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-1 bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl shadow-sm border border-red-200">
                    <h3 class="font-semibold text-red-800 mb-4 flex items-center gap-2"><i class="fas fa-fire"></i> Tarefas Urgentes</h3>
                    <ul class="space-y-2">${urgentTasksHtml}</ul>
                </div>
                <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-white p-6 rounded-xl shadow-sm border">
                        <h3 class="font-semibold text-gray-800 mb-4">Funil de Produtividade</h3>
                        <div class="space-y-3">
                            ${tasksByStatus.map(status => `
                                <div class="w-full">
                                    <div class="flex justify-between text-sm font-medium text-slate-600 mb-1">
                                        <span>${escapeHtml(status.name)}</span>
                                        <span>${status.count}</span>
                                    </div>
                                    <div class="w-full bg-slate-200 rounded-full h-2.5">
                                        <div class="bg-emerald-500 h-2.5 rounded-full" style="width: ${tasksInPeriod.length > 0 ? (status.count / tasksInPeriod.length) * 100 : 0}%"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                     <div class="bg-white p-6 rounded-xl shadow-sm border">
                         <h3 class="font-semibold text-gray-800 mb-4">Carga de Trabalho da Equipe</h3>
                         <div class="space-y-3">${tasksByAssigneeHtml}</div>
                     </div>
                </div>
            </div>
        </div>`;
}

// =================================================================================
// CLIENTS TABLE RENDERING
// =================================================================================

/**
 * Renderiza tabela de clientes
 * @param {HTMLElement} container - Container da página
 */
export function renderClientsTable(container) {
    if (!container) return;

    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border">
            <div class="p-4 border-b">
                <h2 class="text-xl font-bold text-gray-800">Gerenciamento de Contratos de Clientes</h2>
                <p class="text-sm text-gray-500">Clique em "Editar" para ajustar os detalhes do contrato de cada cliente.</p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-500">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3">Nome da Empresa</th>
                            <th scope="col" class="px-6 py-3">Posts/Mês</th>
                            <th scope="col" class="px-6 py-3">Stories/Mês</th>
                            <th scope="col" class="px-6 py-3">Demanda Offline</th>
                            <th scope="col" class="px-6 py-3"><span class="sr-only">Ações</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.clients.map(client => `
                            <tr class="bg-white border-b hover:bg-gray-50">
                                <th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                    ${escapeHtml(client.nome_empresa)}
                                </th>
                                <td class="px-6 py-4">${client.postagens_mensais || 0}</td>
                                <td class="px-6 py-4">${client.storys_mensais || 0}</td>
                                <td class="px-6 py-4">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${client.demanda_offline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                        ${client.demanda_offline ? 'Sim' : 'Não'}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-right">
                                    <button class="edit-contract-btn font-medium text-emerald-600 hover:underline" data-client-id="${client.id_cliente}">Editar Contrato</button>
                                </td>
                            </tr>
                        `).join('')}
                        ${state.clients.length === 0 ? '<tr><td colspan="5" class="px-6 py-4 text-center">Nenhum cliente de marketing encontrado.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// =================================================================================
// IDEAS PAGE RENDERING
// =================================================================================

/**
 * Renderiza página de ideias
 * @param {HTMLElement} container - Container da página
 */
export function renderIdeasPage(container) {
    if (!container) return;

    container.innerHTML = `
        <div class="flex h-full bg-white border-t border-slate-200">
            <aside id="ideas-sidebar" class="w-80 h-full bg-slate-50 border-r border-slate-200 flex flex-col flex-shrink-0">
                <div class="p-4 border-b border-slate-200">
                    <button id="add-new-idea-btn" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center transition-colors">
                        <i class="fas fa-plus mr-2"></i> Nova Ideia
                    </button>
                </div>
                <div id="ideas-list" class="flex-grow overflow-y-auto p-2 space-y-1"></div>
            </aside>
            <main id="idea-content-area" class="h-full flex flex-col flex-grow">
                <div id="idea-placeholder" class="flex-grow flex flex-col items-center justify-center text-center text-slate-500">
                     <i class="fas fa-lightbulb text-6xl text-slate-300 mb-4"></i>
                     <h2 class="text-2xl font-bold">Selecione ou crie uma ideia</h2>
                     <p>Use este espaço para suas anotações e brainstorming.</p>
                </div>
                <div id="idea-editor-wrapper" class="hidden h-full flex-col">
                    <div class="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
                        <input type="text" id="idea-title-input" class="text-2xl font-bold text-slate-800 w-full focus:outline-none bg-transparent" placeholder="Título da Ideia...">
                        <div class="flex items-center gap-2">
                            <button id="save-idea-btn" class="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center transition-colors">
                                <i class="fas fa-save mr-2"></i> Salvar
                            </button>
                            <button id="delete-idea-btn" class="text-slate-400 hover:text-red-500 p-2 rounded-full"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                    <div id="idea-editor-container" class="flex-grow h-full">
                        <div id="idea-editor-quill"></div>
                    </div>
                </div>
            </main>
        </div>
    `;
}

/**
 * Renderiza sidebar de ideias
 */
export function renderIdeasSidebar() {
    const listContainer = document.getElementById('ideas-list');
    if (!listContainer) return;

    if (state.ideas.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-slate-500 p-4 text-sm">Nenhuma ideia criada ainda.</p>`;
        return;
    }

    listContainer.innerHTML = state.ideas.map(idea => `
        <div class="sidebar-item p-3 rounded-lg cursor-pointer hover:bg-slate-200 ${idea.id === state.activeIdeaId ? 'active' : ''}" data-idea-id="${idea.id}">
            <p class="font-semibold text-slate-700 truncate">${escapeHtml(idea.title) || 'Ideia sem título'}</p>
        </div>
    `).join('');
}

/**
 * Renderiza conteúdo da ideia ativa
 * @param {Object} quillEditor - Instância do Quill editor
 */
export function renderIdeaContent(quillEditor) {
    const placeholder = document.getElementById('idea-placeholder');
    const editorWrapper = document.getElementById('idea-editor-wrapper');

    if (!placeholder || !editorWrapper || !quillEditor) return;

    if (state.activeIdeaId) {
        const activeIdea = state.ideas.find(i => i.id === state.activeIdeaId);
        if (activeIdea) {
            placeholder.classList.add('hidden');
            editorWrapper.classList.remove('hidden');
            editorWrapper.classList.add('flex');

            document.getElementById('idea-title-input').value = activeIdea.title || '';
            quillEditor.setContents(activeIdea.content || '', 'silent');
        }
    } else {
        placeholder.classList.remove('hidden');
        editorWrapper.classList.add('hidden');
        editorWrapper.classList.remove('flex');
    }
}

// =================================================================================
// FILTERS RENDERING
// =================================================================================

/**
 * Popula dropdowns de filtros
 */
export function populateFilters() {
    const clientFilter = document.getElementById('client-filter');
    const userFilter = document.getElementById('user-filter');
    const channelFilter = document.getElementById('channel-filter');
    const tagFilter = document.getElementById('tag-filter');

    if (clientFilter) {
        clientFilter.innerHTML = '<option value="all">Todos os Clientes</option>' +
            state.clients.map(c => `<option value="${c.id_cliente}">${escapeHtml(c.nome_empresa)}</option>`).join('');
        clientFilter.value = state.filters.clientId;
    }

    if (userFilter) {
        userFilter.innerHTML = '<option value="all">Todos os Usuários</option>' +
            state.users.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
        userFilter.value = state.filters.userId;
    }

    if (channelFilter) {
        channelFilter.innerHTML = '<option value="all">Todos os Canais</option>' +
            state.channels.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
        channelFilter.value = state.filters.channelId;
    }

    if (tagFilter) {
        tagFilter.innerHTML = '<option value="all">Todas as Tags</option>' +
            state.tags.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        tagFilter.value = state.filters.tagId;
    }
}
