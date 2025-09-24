// Configuração do Cliente Supabase
const SUPABASE_URL = 'https://ccenxfyqwtfpexltuwrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZW54Znlxd3RmcGV4bHR1d3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzE1MTMsImV4cCI6MjA2ODg0NzUxM30.6un31sODuCyd5Dz_pR_kn656k74jjh5CNAfF0YteT7I';
// CORREÇÃO: A variável do cliente foi renomeada para 'supabaseClient' para evitar conflito.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Função para tratar erros de forma consistente
const handleSupabaseError = (error, context) => {
    console.error(`Erro em ${context}:`, error);
    alert(`Ocorreu um erro: ${error.message}. Verifique o console para mais detalhes.`);
};

// =================================================================================
// LÓGICA GERAL E INICIALIZAÇÃO
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {
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

    // Carregar total de tarefas
    const { count: totalCount, error: totalError } = await supabaseClient
        .from('mkt_tasks')
        .select('*', { count: 'exact', head: true });

    if (totalError) handleSupabaseError(totalError, 'Contagem total de tarefas');
    else totalTasksElement.textContent = totalCount || 0;

    // Carregar tarefas concluídas (assumindo que o último status é 'Concluído')
    const { data: statusData, error: statusError } = await supabaseClient
        .from('mkt_status')
        .select('id')
        .order('order', { ascending: false })
        .limit(1);

    if (statusError) {
        handleSupabaseError(statusError, 'Busca de status concluído');
    } else if (statusData.length > 0) {
        const completedStatusId = statusData[0].id;
        const { count: completedCount, error: completedError } = await supabaseClient
            .from('mkt_tasks')
            .select('*', { count: 'exact', head: true })
            .eq('status_id', completedStatusId);
        
        if (completedError) handleSupabaseError(completedError, 'Contagem de tarefas concluídas');
        else completedTasksElement.textContent = completedCount || 0;
    }

    // Carregar tarefas com prazo nos próximos 7 dias
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const { count: upcomingCount, error: upcomingError } = await supabaseClient
        .from('mkt_tasks')
        .select('*', { count: 'exact', head: true })
        .gte('due_date', today.toISOString().split('T')[0])
        .lte('due_date', nextWeek.toISOString().split('T')[0]);

    if (upcomingError) handleSupabaseError(upcomingError, 'Contagem de tarefas futuras');
    else upcomingTasksElement.textContent = upcomingCount || 0;
}


// =================================================================================
// LÓGICA DA PÁGINA DO KANBAN (kanban.html)
// =================================================================================
async function inicializarPaginaKanban() {
    await carregarDadosKanban();
    configurarEventosKanban();
    configurarModalTarefa();
    configurarModalCanais();
}

async function carregarDadosKanban() {
    const kanbanBoard = document.getElementById('kanban-board');
    if (!kanbanBoard) return;
    kanbanBoard.innerHTML = '<p>Carregando quadro...</p>';

    // 1. Buscar Status (Colunas)
    const { data: status, error: statusError } = await supabaseClient
        .from('mkt_status')
        .select('*')
        .order('order', { ascending: true });

    if (statusError) return handleSupabaseError(statusError, 'carregar status');

    // 2. Buscar Canais
    const { data: channels, error: channelsError } = await supabaseClient
        .from('mkt_channels')
        .select('*');
    if (channelsError) return handleSupabaseError(channelsError, 'carregar canais');
    
    // 3. Buscar Tarefas
    const { data: tasks, error: tasksError } = await supabaseClient
        .from('mkt_tasks')
        .select('*, mkt_channels(name)'); // Join com canais para pegar o nome
    if (tasksError) return handleSupabaseError(tasksError, 'carregar tarefas');
    
    kanbanBoard.innerHTML = '';
    
    // Renderizar colunas
    status.forEach(stat => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.dataset.statusId = stat.id;
        
        const tasksInColumn = tasks.filter(task => task.status_id === stat.id);

        column.innerHTML = `
            <div class="column-header">
                <span>${stat.name}</span>
                <span class="task-count">${tasksInColumn.length}</span>
            </div>
            <div class="kanban-cards"></div>
        `;
        kanbanBoard.appendChild(column);

        const cardsContainer = column.querySelector('.kanban-cards');
        // Renderizar tarefas na coluna
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
    // Evento para abrir o modal de nova tarefa
    document.getElementById('add-task-btn').addEventListener('click', () => abrirModalTarefa());

    // Evento para abrir o modal de gerenciar canais
    document.getElementById('manage-channels-btn').addEventListener('click', () => abrirModalCanais());

    // Evento para abrir tarefa existente ao clicar no card
    document.getElementById('kanban-board').addEventListener('click', (e) => {
        const card = e.target.closest('.kanban-card');
        if (card) {
            const taskId = card.dataset.taskId;
            abrirModalTarefa(taskId);
        }
    });
}

// Lógica de Drag and Drop
function configurarDragAndDrop() {
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-cards');
    let draggedItem = null;

    cards.forEach(card => {
        card.addEventListener('dragstart', () => {
            draggedItem = card;
            setTimeout(() => card.classList.add('dragging'), 0);
        });
        card.addEventListener('dragend', () => {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        });
    });

    columns.forEach(column => {
        column.addEventListener('dragover', e => {
            e.preventDefault();
        });
        column.addEventListener('drop', async e => {
            e.preventDefault();
            if (draggedItem) {
                const targetColumnDiv = e.target.closest('.kanban-column');
                const newStatusId = targetColumnDiv.dataset.statusId;
                const taskId = draggedItem.dataset.taskId;

                column.appendChild(draggedItem);
                
                // Atualizar status no Supabase
                const { error } = await supabaseClient
                    .from('mkt_tasks')
                    .update({ status_id: newStatusId })
                    .eq('id', taskId);

                if (error) {
                    handleSupabaseError(error, 'atualizar status da tarefa');
                    carregarDadosKanban(); // Recarrega para reverter a mudança visual
                } else {
                    // Atualizar contadores
                    document.querySelectorAll('.kanban-column').forEach(col => {
                        const count = col.querySelectorAll('.kanban-card').length;
                        col.querySelector('.task-count').textContent = count;
                    });
                }
            }
        });
    });
}


// =================================================================================
// LÓGICA DO MODAL DE TAREFAS (usado em Kanban e Calendário)
// =================================================================================
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const taskIdInput = document.getElementById('task-id');
const deleteTaskBtn = document.getElementById('delete-task-btn');
const fileInfo = document.getElementById('file-info');
let currentFilePath = null;

async function preencherSelectCanais() {
    const channelSelect = document.getElementById('task-channel');
    const { data, error } = await supabaseClient.from('mkt_channels').select('*');
    if (error) {
        handleSupabaseError(error, 'carregar canais para o select');
        channelSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        return;
    }
    channelSelect.innerHTML = '<option value="">Selecione um canal</option>';
    data.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel.id;
        option.textContent = channel.name;
        channelSelect.appendChild(option);
    });
}

async function abrirModalTarefa(taskId = null) {
    taskForm.reset();
    fileInfo.innerHTML = '';
    currentFilePath = null;
    deleteTaskBtn.classList.add('hidden');
    await preencherSelectCanais();
    
    if (taskId) {
        modalTitle.textContent = 'Editar Tarefa';
        const { data, error } = await supabaseClient
            .from('mkt_tasks')
            .select('*')
            .eq('id', taskId)
            .single();

        if (error) return handleSupabaseError(error, 'buscar dados da tarefa para edição');
        
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
            fileInfo.innerHTML = `Arquivo atual: <a href="${fileURL.publicUrl}" target="_blank">${fileName}</a>`;
        }
        
        deleteTaskBtn.classList.remove('hidden');
    } else {
        modalTitle.textContent = 'Nova Tarefa';
        taskIdInput.value = '';
    }
    
    taskModal.classList.remove('hidden');
}

function fecharModalTarefa() {
    taskModal.classList.add('hidden');
}

async function salvarTarefa(e) {
    e.preventDefault();
    const id = taskIdInput.value;
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const channel_id = document.getElementById('task-channel').value;
    const assignee = document.getElementById('task-assignee').value;
    const due_date = document.getElementById('task-due-date').value;
    const fileInput = document.getElementById('task-file');
    const file = fileInput.files[0];

    let filePath = currentFilePath;
    
    if (file) {
        // Faz o upload do novo arquivo
        const newFileName = `${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('mkt_files')
            .upload(newFileName, file);

        if (uploadError) return handleSupabaseError(uploadError, 'upload de arquivo');
        filePath = uploadData.path;
    }

    const taskData = {
        title,
        description,
        channel_id,
        assignee,
        due_date: due_date || null,
        file_path: filePath
    };

    let error;
    if (id) { // Editar
        const { error: updateError } = await supabaseClient
            .from('mkt_tasks')
            .update(taskData)
            .eq('id', id);
        error = updateError;
    } else { // Criar
        // Pega o primeiro status_id para ser o padrão
        const { data: firstStatus, error: statusError } = await supabaseClient
            .from('mkt_status')
            .select('id')
            .order('order', { ascending: true })
            .limit(1);
        if (statusError) return handleSupabaseError(statusError, 'buscar status inicial');
        
        taskData.status_id = firstStatus[0].id;
        
        const { error: insertError } = await supabaseClient
            .from('mkt_tasks')
            .insert([taskData]);
        error = insertError;
    }
    
    if (error) handleSupabaseError(error, 'salvar tarefa');
    else {
        fecharModalTarefa();
        // Recarregar a view apropriada
        if (window.location.pathname.endsWith('kanban.html')) carregarDadosKanban();
        if (window.location.pathname.endsWith('calendario.html')) renderizarCalendario();
    }
}

async function deletarTarefa() {
    const id = taskIdInput.value;
    if (!id || !confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    // Primeiro, deleta o arquivo do storage se existir
    if (currentFilePath) {
        const { error: fileError } = await supabaseClient.storage
            .from('mkt_files')
            .remove([currentFilePath]);
        if (fileError) console.error('Erro ao deletar arquivo do storage:', fileError); // Não para o processo se o arquivo não puder ser deletado
    }

    // Depois, deleta a tarefa
    const { error } = await supabaseClient
        .from('mkt_tasks')
        .delete()
        .eq('id', id);

    if (error) handleSupabaseError(error, 'deletar tarefa');
    else {
        fecharModalTarefa();
        if (window.location.pathname.endsWith('kanban.html')) carregarDadosKanban();
        if (window.location.pathname.endsWith('calendario.html')) renderizarCalendario();
    }
}

function configurarModalTarefa() {
    if(!taskModal) return;
    taskModal.querySelector('#cancel-btn').addEventListener('click', fecharModalTarefa);
    deleteTaskBtn.addEventListener('click', deletarTarefa);
    taskForm.addEventListener('submit', salvarTarefa);
}


// =================================================================================
// LÓGICA DO MODAL DE CANAIS (kanban.html)
// =================================================================================
const channelsModal = document.getElementById('channels-modal');
const newChannelInput = document.getElementById('new-channel-name');
const channelsListContainer = document.getElementById('channels-list-container');

async function carregarCanais() {
    if(!channelsListContainer) return;
    channelsListContainer.innerHTML = '<p>Carregando...</p>';
    const { data, error } = await supabaseClient.from('mkt_channels').select('*');
    if (error) {
        handleSupabaseError(error, 'carregar lista de canais');
        channelsListContainer.innerHTML = '<p>Erro ao carregar canais.</p>';
        return;
    }

    channelsListContainer.innerHTML = '';
    data.forEach(channel => {
        const item = document.createElement('div');
        item.className = 'channel-item';
        item.innerHTML = `
            <span>${channel.name}</span>
            <button class="delete-channel-btn" data-id="${channel.id}"><i class="ph ph-trash"></i></button>
        `;
        channelsListContainer.appendChild(item);
    });
}

async function abrirModalCanais() {
    if(!channelsModal) return;
    await carregarCanais();
    channelsModal.classList.remove('hidden');
}

function fecharModalCanais() {
    if(!channelsModal) return;
    channelsModal.classList.add('hidden');
}

async function adicionarCanal() {
    const name = newChannelInput.value.trim();
    if (!name) return;

    const { error } = await supabaseClient.from('mkt_channels').insert([{ name }]);
    if (error) handleSupabaseError(error, 'adicionar canal');
    else {
        newChannelInput.value = '';
        await carregarCanais();
    }
}

async function deletarCanal(id) {
     if (!confirm('Excluir um canal também removerá a associação de todas as tarefas a ele. Deseja continuar?')) return;
    
    // Antes de deletar o canal, é preciso desassociar as tarefas.
    const { error: updateError } = await supabaseClient
      .from('mkt_tasks')
      .update({ channel_id: null })
      .eq('channel_id', id);
      
    if (updateError) return handleSupabaseError(updateError, 'desassociar tarefas do canal');
    
    // Agora pode deletar o canal
    const { error: deleteError } = await supabaseClient.from('mkt_channels').delete().eq('id', id);
    if (deleteError) handleSupabaseError(deleteError, 'deletar canal');
    else await carregarCanais();
}

function configurarModalCanais() {
    if(!channelsModal) return;
    channelsModal.querySelector('#close-channels-modal-btn').addEventListener('click', fecharModalCanais);
    channelsModal.querySelector('#add-channel-btn').addEventListener('click', adicionarCanal);
    channelsListContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.delete-channel-btn');
        if (btn) deletarCanal(btn.dataset.id);
    });
}


// =================================================================================
// LÓGICA DA PÁGINA DO CALENDÁRIO (calendario.html)
// =================================================================================
let currentDate = new Date();
let tasksDoCalendario = [];

function inicializarPaginaCalendario() {
    renderizarCalendario();
    configurarEventosCalendario();
    configurarModalTarefa(); // O calendário também usa o modal de tarefa
}

async function renderizarCalendario() {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;

    // Buscar todas as tarefas que têm data de entrega
    const { data, error } = await supabaseClient.from('mkt_tasks').select('*').not('due_date', 'is', null);
    if (error) return handleSupabaseError(error, 'buscar tarefas para o calendário');
    tasksDoCalendario = data;
    
    calendarGrid.innerHTML = '';
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    document.getElementById('current-month-year').textContent = `${currentDate.toLocaleString('pt-BR', { month: 'long' })} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const lastDayOfPrevMonth = new Date(year, month, 0);

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Domingo, 1 = Segunda, ...

    // Preencher dias do mês anterior
    for (let i = startDayOfWeek; i > 0; i--) {
        const day = lastDayOfPrevMonth.getDate() - i + 1;
        calendarGrid.innerHTML += `<div class="calendar-day not-in-month"><span>${day}</span></div>`;
    }

    // Preencher dias do mês atual
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        const dayDate = new Date(year, month, day);
        if (dayDate.toDateString() === new Date().toDateString()) {
            dayDiv.classList.add('today');
        }

        let tasksHtml = '';
        const tasksForThisDay = tasksDoCalendario.filter(t => {
            const taskDate = new Date(t.due_date + 'T00:00:00');
            return taskDate.toDateString() === dayDate.toDateString();
        });

        tasksForThisDay.forEach(task => {
            tasksHtml += `<div class="calendar-task-item" data-task-id="${task.id}">${task.title}</div>`;
        });
        
        dayDiv.innerHTML = `<div class="day-number">${day}</div><div class="calendar-tasks">${tasksHtml}</div>`;
        calendarGrid.appendChild(dayDiv);
    }
}

function configurarEventosCalendario() {
    const calendarNav = document.getElementById('calendar-nav');
    if(!calendarNav) return;
    
    calendarNav.querySelector('#prev-month-btn').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderizarCalendario();
    });
    calendarNav.querySelector('#next-month-btn').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderizarCalendario();
    });

    document.getElementById('calendar-grid').addEventListener('click', (e) => {
        const taskItem = e.target.closest('.calendar-task-item');
        if (taskItem) {
            const taskId = taskItem.dataset.taskId;
            abrirModalTarefa(taskId);
        }
    });
}

