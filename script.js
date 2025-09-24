// =============================================
//      CONFIGURAÇÃO E INICIALIZAÇÃO
// =============================================

const SUPABASE_URL = 'https://ccenxfyqwtfpexltuwrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZW54Znlxd3RmcGV4bHR1d3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzE1MTMsImV4cCI6MjA2ODg0NzUxM30.6un31sODuCyd5Dz_pR_kn656k74jjh5CNAfF0YteT7I';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================
//      LÓGICA DO PORTAL (GERAL)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.dashboard-grid')) {
        initDashboard();
    }
    if (document.querySelector('.kanban-board')) {
        initKanban();
    }
});

// =============================================
//      LÓGICA DA DASHBOARD
// =============================================

async function initDashboard() {
    console.log("Inicializando a Dashboard...");
    // Em breve: Carregar KPIs e dados para os cards da dashboard
}

// =============================================
//      LÓGICA DO KANBAN
// =============================================

// Elementos do DOM
let modal, taskForm, kanbanBoard;

async function initKanban() {
    console.log("Inicializando o Kanban...");
    modal = document.getElementById('task-modal');
    taskForm = document.getElementById('task-form');
    kanbanBoard = document.getElementById('kanban-board');
    
    await carregarDadosKanban();
    configurarEventosModal();
}

function configurarEventosModal() {
    const addTaskBtn = document.getElementById('add-task-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    addTaskBtn.addEventListener('click', abrirModalParaNovaTarefa);
    cancelBtn.addEventListener('click', fecharModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) fecharModal();
    });
    taskForm.addEventListener('submit', handleFormSubmit);
}

async function carregarDadosKanban() {
    console.log("Carregando dados do Supabase para o Kanban...");
    kanbanBoard.innerHTML = '<p>Carregando colunas e tarefas...</p>';

    const [statusRes, channelsRes, tasksRes] = await Promise.all([
        supabaseClient.from('mkt_statuses').select('*').order('order', { ascending: true }),
        supabaseClient.from('mkt_channels').select('*'),
        supabaseClient.from('mkt_tasks').select(`*, channel:mkt_channels(name)`)
    ]);

    if (statusRes.error || channelsRes.error || tasksRes.error) {
        console.error("Erro ao carregar dados:", statusRes.error || channelsRes.error || tasksRes.error);
        kanbanBoard.innerHTML = '<p>Ocorreu um erro ao carregar os dados. Verifique o console.</p>';
        return;
    }

    const statuses = statusRes.data;
    const channels = channelsRes.data;
    const tasks = tasksRes.data;

    renderizarColunas(statuses);
    renderizarTarefas(tasks);
    popularCanaisNoModal(channels);
}

function renderizarColunas(statuses) {
    kanbanBoard.innerHTML = ''; // Limpa o "Carregando..."
    statuses.forEach(status => {
        const columnEl = document.createElement('div');
        columnEl.className = 'kanban-column';
        columnEl.dataset.statusId = status.id;
        columnEl.innerHTML = `
            <div class="kanban-column-header">
                <h4>${status.name}</h4>
                <span class="task-count" id="count-${status.id}">0</span>
            </div>
            <div class="kanban-tasks" id="tasks-${status.id}"></div>
        `;
        kanbanBoard.appendChild(columnEl);
    });
    configurarDragAndDrop();
}

function renderizarTarefas(tasks) {
    // Primeiro, limpa todas as colunas
    document.querySelectorAll('.kanban-tasks').forEach(col => col.innerHTML = '');
    // Zera contadores
    document.querySelectorAll('.task-count').forEach(count => count.textContent = '0');

    tasks.forEach(task => {
        const columnContent = document.getElementById(`tasks-${task.status_id}`);
        if (columnContent) {
            const taskEl = document.createElement('div');
            taskEl.className = 'kanban-task';
            taskEl.draggable = true;
            taskEl.dataset.taskId = task.id;
            
            taskEl.innerHTML = `
                <p class="task-title">${task.title}</p>
                <div class="task-footer">
                    <span class="task-channel">${task.channel ? task.channel.name : 'Sem Canal'}</span>
                    ${task.assignee ? `<span><i class="ph ph-user"></i> ${task.assignee}</span>` : ''}
                </div>
            `;
            
            taskEl.addEventListener('click', () => abrirModalParaEdicao(task));
            columnContent.appendChild(taskEl);

            // Atualiza contador
            const countEl = document.getElementById(`count-${task.status_id}`);
            countEl.textContent = parseInt(countEl.textContent) + 1;
        }
    });
}

function popularCanaisNoModal(channels) {
    const channelSelect = document.getElementById('task-channel');
    channelSelect.innerHTML = '<option value="">Selecione um canal...</option>';
    channels.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel.id;
        option.textContent = channel.name;
        channelSelect.appendChild(option);
    });
}

function abrirModalParaNovaTarefa() {
    taskForm.reset();
    document.getElementById('modal-title').textContent = 'Nova Tarefa';
    document.getElementById('task-id').value = '';
    document.getElementById('delete-task-btn').classList.add('hidden');
    document.getElementById('file-info').innerHTML = '';
    modal.classList.remove('hidden');
}

function abrirModalParaEdicao(task) {
    taskForm.reset();
    document.getElementById('modal-title').textContent = 'Editar Tarefa';
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-description').value = task.description || '';
    document.getElementById('task-channel').value = task.channel_id;
    document.getElementById('task-assignee').value = task.assignee || '';
    document.getElementById('task-due-date').value = task.due_date || '';

    // Lógica do arquivo
    const fileInfo = document.getElementById('file-info');
    if (task.file_path) {
        const { data } = supabaseClient.storage.from('mkt_files').getPublicUrl(task.file_path);
        fileInfo.innerHTML = `Arquivo atual: <a href="${data.publicUrl}" target="_blank">${task.file_path.split('/').pop()}</a>`;
    } else {
        fileInfo.innerHTML = '';
    }

    const deleteBtn = document.getElementById('delete-task-btn');
    deleteBtn.classList.remove('hidden');
    deleteBtn.onclick = () => deletarTarefa(task.id, task.file_path);

    modal.classList.remove('hidden');
}


function fecharModal() {
    modal.classList.add('hidden');
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const taskId = document.getElementById('task-id').value;
    const fileInput = document.getElementById('task-file');
    const file = fileInput.files[0];
    let filePath = null;

    // 1. Fazer upload do arquivo, se existir um novo
    if (file) {
        filePath = `public/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabaseClient.storage
            .from('mkt_files')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Erro no upload do arquivo:', uploadError);
            alert('Não foi possível enviar o arquivo.');
            return;
        }
    }

    // 2. Montar o objeto da tarefa
    const taskData = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        channel_id: document.getElementById('task-channel').value,
        assignee: document.getElementById('task-assignee').value,
        due_date: document.getElementById('task-due-date').value || null,
    };
    if (filePath) {
        taskData.file_path = filePath;
    }

    // 3. Salvar no banco (criar ou atualizar)
    let error;
    if (taskId) { // Atualizar
        const { error: updateError } = await supabaseClient
            .from('mkt_tasks')
            .update(taskData)
            .eq('id', taskId);
        error = updateError;
    } else { // Criar
        // Por padrão, novas tarefas vão para a primeira coluna (status)
        const firstStatus = kanbanBoard.querySelector('.kanban-column')?.dataset.statusId;
        if(firstStatus) taskData.status_id = firstStatus;

        const { error: insertError } = await supabaseClient
            .from('mkt_tasks')
            .insert(taskData);
        error = insertError;
    }

    if (error) {
        console.error('Erro ao salvar tarefa:', error);
        alert('Ocorreu um erro ao salvar a tarefa.');
    } else {
        fecharModal();
        carregarDadosKanban(); // Recarrega o quadro
    }
}

async function deletarTarefa(taskId, filePath) {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    // Deletar o arquivo do storage, se existir
    if (filePath) {
        await supabaseClient.storage.from('mkt_files').remove([filePath]);
    }
    
    const { error } = await supabaseClient
        .from('mkt_tasks')
        .delete()
        .eq('id', taskId);

    if (error) {
        console.error('Erro ao deletar tarefa:', error);
        alert('Ocorreu um erro ao deletar a tarefa.');
    } else {
        fecharModal();
        carregarDadosKanban();
    }
}

// =============================================
//      LÓGICA DE DRAG AND DROP
// =============================================

function configurarDragAndDrop() {
    const tasks = document.querySelectorAll('.kanban-task');
    const columns = document.querySelectorAll('.kanban-column .kanban-tasks');
    let draggedTask = null;

    tasks.forEach(task => {
        task.addEventListener('dragstart', () => {
            draggedTask = task;
            setTimeout(() => task.style.display = 'none', 0);
        });
        task.addEventListener('dragend', () => {
            setTimeout(() => {
                draggedTask.style.display = 'block';
                draggedTask = null;
            }, 0);
        });
    });

    columns.forEach(column => {
        column.addEventListener('dragover', e => {
            e.preventDefault();
        });
        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (draggedTask) {
                const newStatusId = column.parentElement.dataset.statusId;
                const taskId = draggedTask.dataset.taskId;

                // Atualizar no DOM para feedback imediato
                column.appendChild(draggedTask);

                // Atualizar no Supabase
                const { error } = await supabaseClient
                    .from('mkt_tasks')
                    .update({ status_id: newStatusId })
                    .eq('id', taskId);
                
                if (error) {
                    console.error('Erro ao atualizar status da tarefa:', error);
                    alert('Não foi possível mover a tarefa. Recarregando...');
                }
                // Recarregar o quadro para garantir consistência
                carregarDadosKanban();
            }
        });
    });
}

