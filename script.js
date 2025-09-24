// Configuração do Cliente Supabase
const SUPABASE_URL = 'https://ccenxfyqwtfpexltuwrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZW54Znlxd3RmcGV4bHR1d3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzE1MTMsImV4cCI6MjA2ODg0NzUxM30.6un31sODuCyd5Dz_pR_kn656k74jjh5CNAfF0YteT7I';

let supabaseClient = null;

// =================================================================================
// BOA PRÁTICA: GESTÃO DE ESTADO
// Armazenamos dados comuns aqui para evitar chamadas repetidas ao banco de dados.
// =================================================================================
const state = {
    statuses: [],
    channels: [],
    tasks: [],
};

// Função para tratar erros de forma consistente
const handleSupabaseError = (error, context) => {
    console.error(`Erro em ${context}:`, error);
    alert(`Ocorreu um erro: ${error.message}. Verifique o console para mais detalhes.`);
};

// =================================================================================
// LÓGICA GERAL E INICIALIZAÇÃO
// =================================================================================
document.addEventListener('DOMContentLoaded', () => {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const path = window.location.pathname;

    if (path.endsWith('/') || path.endsWith('index.html')) {
        carregarDadosDashboard();
    } else if (path.endsWith('kanban.html')) {
        inicializarPaginaKanban();
    } else if (path.endsWith('calendario.html')) {
        inicializarPaginaCalendario();
    }
});

// =================================================================================
// LÓGICA DO DASHBOARD (index.html)
// =================================================================================
async function carregarDadosDashboard() {
    const totalTasksElement = document.getElementById('total-tasks-value');
    const completedTasksElement = document.getElementById('completed-tasks-value');
    const upcomingTasksElement = document.getElementById('upcoming-tasks-value');

    const { count: totalCount, error: totalError } = await supabaseClient
        .from('mkt_tasks').select('*', { count: 'exact', head: true });
    if (totalError) handleSupabaseError(totalError, 'Contagem total de tarefas');
    else totalTasksElement.textContent = totalCount || 0;

    const { data: statusData, error: statusError } = await supabaseClient
        .from('mkt_status').select('id').order('order', { ascending: false }).limit(1);
    if (statusError) {
        handleSupabaseError(statusError, 'Busca de status concluído');
    } else if (statusData.length > 0) {
        const completedStatusId = statusData[0].id;
        const { count: completedCount, error: completedError } = await supabaseClient
            .from('mkt_tasks').select('*', { count: 'exact', head: true }).eq('status_id', completedStatusId);
        if (completedError) handleSupabaseError(completedError, 'Contagem de tarefas concluídas');
        else completedTasksElement.textContent = completedCount || 0;
    }

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const { count: upcomingCount, error: upcomingError } = await supabaseClient
        .from('mkt_tasks').select('*', { count: 'exact', head: true })
        .gte('due_date', today.toISOString().split('T')[0])
        .lte('due_date', nextWeek.toISOString().split('T')[0]);
    if (upcomingError) handleSupabaseError(upcomingError, 'Contagem de tarefas futuras');
    else upcomingTasksElement.textContent = upcomingCount || 0;
}

// =================================================================================
// LÓGICA DA PÁGINA DO KANBAN (kanban.html)
// =================================================================================
async function inicializarPaginaKanban() {
    const kanbanBoard = document.getElementById('kanban-board');
    if (kanbanBoard) kanbanBoard.innerHTML = '<p>A carregar quadro...</p>';
    
    await fetchKanbanData();
    renderKanbanBoard();
    configurarEventosKanban();
    configurarModalTarefa();
    configurarModalCanais();
}

async function fetchKanbanData() {
    const [statusRes, channelsRes, tasksRes] = await Promise.all([
        supabaseClient.from('mkt_status').select('*').order('order', { ascending: true }),
        supabaseClient.from('mkt_channels').select('*'),
        supabaseClient.from('mkt_tasks').select('*, mkt_channels(name)')
    ]);

    if (statusRes.error) handleSupabaseError(statusRes.error, 'carregar status');
    else state.statuses = statusRes.data;

    if (channelsRes.error) handleSupabaseError(channelsRes.error, 'carregar canais');
    else state.channels = channelsRes.data;

    if (tasksRes.error) handleSupabaseError(tasksRes.error, 'carregar tarefas');
    else state.tasks = tasksRes.data;
}

function renderKanbanBoard() {
    const kanbanBoard = document.getElementById('kanban-board');
    if (!kanbanBoard) return;
    kanbanBoard.innerHTML = '';
    
    state.statuses.forEach(stat => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.dataset.statusId = stat.id;
        
        const tasksInColumn = state.tasks.filter(task => task.status_id === stat.id);
        column.innerHTML = `
            <div class="column-header">
                <span>${stat.name}</span>
                <span class="task-count">${tasksInColumn.length}</span>
            </div>
            <div class="kanban-cards"></div>
        `;
        kanbanBoard.appendChild(column);

        const cardsContainer = column.querySelector('.kanban-cards');
        tasksInColumn.forEach(task => {
            const card = criarCardTarefa(task);
            cardsContainer.appendChild(card);
        });
    });
    configurarDragAndDrop();
}

function criarCardTarefa(task) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.taskId = task.id;

    const dueDate = task.due_date ? new Date(task.due_date + 'T00:00:00') : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = dueDate && dueDate < today;

    card.innerHTML = `
        <h4>${task.title}</h4>
        <div class="card-footer">
            <span class="card-channel-tag">${task.mkt_channels ? task.mkt_channels.name : 'Sem Canal'}</span>
            <span class="card-due-date ${isOverdue ? 'overdue' : ''}">
                ${dueDate ? `<i class="ph ph-clock"></i> ${dueDate.toLocaleDateString('pt-BR')}` : ''}
            </span>
        </div>
    `;
    return card;
}

function configurarEventosKanban() {
    document.getElementById('add-task-btn').addEventListener('click', () => abrirModalTarefa());
    document.getElementById('manage-channels-btn').addEventListener('click', () => abrirModalCanais());
    document.getElementById('kanban-board').addEventListener('click', (e) => {
        const card = e.target.closest('.kanban-card');
        if (card) {
            const taskId = card.dataset.taskId;
            abrirModalTarefa(taskId);
        }
    });
}

function configurarDragAndDrop() {
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-cards');
    let draggedItem = null;

    cards.forEach(card => {
        card.addEventListener('dragstart', () => { draggedItem = card; setTimeout(() => card.classList.add('dragging'), 0); });
        card.addEventListener('dragend', () => { draggedItem.classList.remove('dragging'); draggedItem = null; });
    });

    columns.forEach(column => {
        column.addEventListener('dragover', e => e.preventDefault());
        column.addEventListener('drop', async e => {
            e.preventDefault();
            if (draggedItem) {
                const targetColumnDiv = e.target.closest('.kanban-column');
                const newStatusId = targetColumnDiv.dataset.statusId;
                const taskId = draggedItem.dataset.taskId;
                column.appendChild(draggedItem);
                
                const { error } = await supabaseClient.from('mkt_tasks').update({ status_id: newStatusId }).eq('id', taskId);
                if (error) {
                    handleSupabaseError(error, 'atualizar status da tarefa');
                    await fetchKanbanData(); // Reverte a mudança buscando dados frescos
                    renderKanbanBoard();
                } else {
                    // Atualiza o estado local
                    const taskIndex = state.tasks.findIndex(t => t.id == taskId);
                    if (taskIndex !== -1) state.tasks[taskIndex].status_id = parseInt(newStatusId, 10);
                    // Atualiza contadores
                    document.querySelectorAll('.kanban-column').forEach(col => {
                        col.querySelector('.task-count').textContent = col.querySelectorAll('.kanban-card').length;
                    });
                }
            }
        });
    });
}

// =================================================================================
// LÓGICA DO MODAL DE TAREFAS
// =================================================================================
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
let currentFilePath = null;

function preencherSelectCanais() {
    const channelSelect = document.getElementById('task-channel');
    channelSelect.innerHTML = '<option value="">Selecione um canal</option>';
    state.channels.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel.id;
        option.textContent = channel.name;
        channelSelect.appendChild(option);
    });
}

async function abrirModalTarefa(taskId = null) {
    const modalTitle = document.getElementById('modal-title');
    const taskIdInput = document.getElementById('task-id');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const fileInfo = document.getElementById('file-info');

    taskForm.reset();
    fileInfo.innerHTML = '';
    currentFilePath = null;
    deleteTaskBtn.classList.add('hidden');
    preencherSelectCanais();
    
    if (taskId) {
        modalTitle.textContent = 'Editar Tarefa';
        const data = state.tasks.find(t => t.id == taskId);
        if (!data) return handleSupabaseError({ message: "Tarefa não encontrada no estado local." }, 'abrir modal de edição');
        
        taskIdInput.value = data.id;
        document.getElementById('task-title').value = data.title;
        document.getElementById('task-description').value = data.description || '';
        document.getElementById('task-channel').value = data.channel_id;
        document.getElementById('task-assignee').value = data.assignee || '';
        document.getElementById('task-due-date').value = data.due_date;
        
        if (data.file_path) {
            currentFilePath = data.file_path;
            const fileName = data.file_path.split('/').pop();
            const { data: fileURL } = supabaseClient.storage.from('mkt_files').getPublicUrl(data.file_path);
            fileInfo.innerHTML = `Arquivo atual: <a href="${fileURL.publicUrl}" target="_blank" class="text-green-700 hover:underline">${fileName}</a>`;
        }
        
        deleteTaskBtn.classList.remove('hidden');
    } else {
        modalTitle.textContent = 'Nova Tarefa';
        taskIdInput.value = '';
    }
    taskModal.classList.remove('hidden');
}

function fecharModalTarefa() { taskModal.classList.add('hidden'); }

async function salvarTarefa(e) {
    e.preventDefault();
    const saveButton = document.querySelector('#task-form button[type="submit"]');
    const originalButtonText = saveButton.textContent;
    saveButton.disabled = true;
    saveButton.textContent = 'A salvar...';

    const id = document.getElementById('task-id').value;
    const fileInput = document.getElementById('task-file');
    const file = fileInput.files[0];
    let filePath = currentFilePath;
    
    try {
        if (file) {
            const newFileName = `${Date.now()}-${file.name}`;
            const { data, error } = await supabaseClient.storage.from('mkt_files').upload(newFileName, file);
            if (error) throw error;
            filePath = data.path;
        }

        const taskData = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-description').value,
            channel_id: document.getElementById('task-channel').value || null,
            assignee: document.getElementById('task-assignee').value,
            due_date: document.getElementById('task-due-date').value || null,
            file_path: filePath
        };

        if (id) {
            const { error } = await supabaseClient.from('mkt_tasks').update(taskData).eq('id', id);
            if (error) throw error;
        } else {
            taskData.status_id = state.statuses[0]?.id; // Pega o primeiro status
            const { error } = await supabaseClient.from('mkt_tasks').insert([taskData]);
            if (error) throw error;
        }
        
        fecharModalTarefa();
        await fetchKanbanData(); // Atualiza o estado
        if (window.location.pathname.endsWith('kanban.html')) renderKanbanBoard();
        if (window.location.pathname.endsWith('calendario.html')) renderizarCalendario();

    } catch (error) {
        handleSupabaseError(error, 'salvar tarefa');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = originalButtonText;
    }
}

async function deletarTarefa() {
    const id = document.getElementById('task-id').value;
    if (!id || !confirm('Tem a certeza que deseja excluir esta tarefa?')) return;
    
    const deleteButton = document.getElementById('delete-task-btn');
    const originalButtonText = deleteButton.textContent;
    deleteButton.disabled = true;
    deleteButton.textContent = 'A excluir...';

    try {
        if (currentFilePath) {
            await supabaseClient.storage.from('mkt_files').remove([currentFilePath]);
        }
        const { error } = await supabaseClient.from('mkt_tasks').delete().eq('id', id);
        if (error) throw error;

        fecharModalTarefa();
        await fetchKanbanData();
        if (window.location.pathname.endsWith('kanban.html')) renderKanbanBoard();
        if (window.location.pathname.endsWith('calendario.html')) renderizarCalendario();

    } catch (error) {
        handleSupabaseError(error, 'deletar tarefa');
    } finally {
        deleteButton.disabled = false;
        deleteButton.textContent = originalButtonText;
    }
}

function configurarModalTarefa() {
    if (!taskModal) return;
    taskModal.querySelector('#cancel-btn').addEventListener('click', fecharModalTarefa);
    document.getElementById('delete-task-btn').addEventListener('click', deletarTarefa);
    taskForm.addEventListener('submit', salvarTarefa);
}

// =================================================================================
// LÓGICA DO MODAL DE CANAIS
// =================================================================================
const channelsModal = document.getElementById('channels-modal');

async function carregarCanaisModal() {
    const channelsListContainer = document.getElementById('channels-list-container');
    if (!channelsListContainer) return;
    channelsListContainer.innerHTML = '';
    state.channels.forEach(channel => {
        const item = document.createElement('div');
        item.className = 'channel-item';
        item.innerHTML = `
            <span>${channel.name}</span>
            <button class="delete-channel-btn" data-id="${channel.id}"><i class="ph ph-trash"></i></button>
        `;
        channelsListContainer.appendChild(item);
    });
}

function abrirModalCanais() {
    if (channelsModal) {
        carregarCanaisModal();
        channelsModal.classList.remove('hidden');
    }
}
function fecharModalCanais() { if (channelsModal) channelsModal.classList.add('hidden'); }

async function adicionarCanal() {
    const newChannelInput = document.getElementById('new-channel-name');
    const name = newChannelInput.value.trim();
    if (!name) return;
    
    const addButton = document.getElementById('add-channel-btn');
    addButton.disabled = true;

    const { error } = await supabaseClient.from('mkt_channels').insert([{ name }]);
    if (error) handleSupabaseError(error, 'adicionar canal');
    else {
        newChannelInput.value = '';
        const { data } = await supabaseClient.from('mkt_channels').select('*');
        state.channels = data || []; // Atualiza o estado
        carregarCanaisModal();
    }
    addButton.disabled = false;
}

async function deletarCanal(id) {
    if (!confirm('Excluir um canal também removerá a associação de todas as tarefas a ele. Deseja continuar?')) return;
    
    const { error: updateError } = await supabaseClient.from('mkt_tasks').update({ channel_id: null }).eq('channel_id', id);
    if (updateError) return handleSupabaseError(updateError, 'desassociar tarefas do canal');
    
    const { error: deleteError } = await supabaseClient.from('mkt_channels').delete().eq('id', id);
    if (deleteError) handleSupabaseError(deleteError, 'deletar canal');
    else {
        const { data } = await supabaseClient.from('mkt_channels').select('*');
        state.channels = data || []; // Atualiza o estado
        carregarCanaisModal();
    }
}

function configurarModalCanais() {
    if (!channelsModal) return;
    document.getElementById('close-channels-modal-btn').addEventListener('click', fecharModalCanais);
    document.getElementById('add-channel-btn').addEventListener('click', adicionarCanal);
    document.getElementById('channels-list-container').addEventListener('click', (e) => {
        const btn = e.target.closest('.delete-channel-btn');
        if (btn) deletarCanal(btn.dataset.id);
    });
}

// =================================================================================
// LÓGICA DA PÁGINA DO CALENDÁRIO
// =================================================================================
let currentDate = new Date();

async function inicializarPaginaCalendario() {
    await fetchKanbanData(); // Calendário precisa das tarefas
    renderizarCalendario();
    configurarEventosCalendario();
    configurarModalTarefa();
}

function renderizarCalendario() {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;
    
    const tasksDoCalendario = state.tasks.filter(t => t.due_date);
    calendarGrid.innerHTML = '';
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    document.getElementById('current-month-year').textContent = `${currentDate.toLocaleString('pt-BR', { month: 'long' })} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const lastDayOfPrevMonth = new Date(year, month, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();

    for (let i = startDayOfWeek; i > 0; i--) {
        const day = lastDayOfPrevMonth.getDate() - i + 1;
        calendarGrid.innerHTML += `<div class="calendar-day not-in-month"><span>${day}</span></div>`;
    }

    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        const dayDate = new Date(year, month, day);
        if (dayDate.toDateString() === new Date().toDateString()) {
            dayDiv.classList.add('today');
        }

        let tasksHtml = '';
        const tasksForThisDay = tasksDoCalendario.filter(t => new Date(t.due_date + 'T00:00:00').toDateString() === dayDate.toDateString());
        tasksForThisDay.forEach(task => {
            tasksHtml += `<div class="calendar-task-item" data-task-id="${task.id}">${task.title}</div>`;
        });
        
        dayDiv.innerHTML = `<div class="day-number">${day}</div><div class="calendar-tasks">${tasksHtml}</div>`;
        calendarGrid.appendChild(dayDiv);
    }
}

function configurarEventosCalendario() {
    const calendarNav = document.getElementById('calendar-nav');
    if (!calendarNav) return;
    
    calendarNav.querySelector('#prev-month-btn').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderizarCalendario(); });
    calendarNav.querySelector('#next-month-btn').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderizarCalendario(); });

    document.getElementById('calendar-grid').addEventListener('click', (e) => {
        const taskItem = e.target.closest('.calendar-task-item');
        if (taskItem) {
            const taskId = taskItem.dataset.taskId;
            abrirModalTarefa(taskId);
        }
    });
}

