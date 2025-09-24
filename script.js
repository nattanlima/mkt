// =============================================
//      CONFIGURAÇÃO E INICIALIZAÇÃO
// =============================================

// 1. Suas credenciais do Supabase já estão aqui
const SUPABASE_URL = 'https://ccenxfyqwtfpexltuwrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZW54Znlxd3RmcGV4bHR1d3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzE1MTMsImV4cCI6MjA2ODg0NzUxM30.6un31sODuCyd5Dz_pR_kn656k74jjh5CNAfF0YteT7I';

// 2. Inicializa o cliente do Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================
//      LÓGICA DO PORTAL (GERAL)
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    // Verifica em qual página estamos para executar o código certo
    if (document.querySelector('.dashboard-grid')) {
        console.log("Estamos na Dashboard");
        initDashboard();
    }

    if (document.querySelector('.kanban-board')) {
        console.log("Estamos no Kanban");
        initKanban();
    }
});


// =============================================
//      LÓGICA DA DASHBOARD
// =============================================

async function initDashboard() {
    // Funções para carregar os dados da Dashboard
    // (Ainda não implementadas)
    console.log("Inicializando a Dashboard...");
}


// =============================================
//      LÓGICA DO KANBAN
// =============================================

async function initKanban() {
    console.log("Inicializando o Kanban...");
    await carregarDadosKanban();

    // Lógica para abrir e fechar o modal
    const addTaskBtn = document.getElementById('add-task-btn');
    const modal = document.getElementById('task-modal');
    const cancelBtn = document.getElementById('cancel-btn');

    addTaskBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        // Limpar o formulário para uma nova tarefa
    });

    cancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Lógica do formulário (ainda não implementada)
    const taskForm = document.getElementById('task-form');
    taskForm.addEventListener('submit', handleFormSubmit);
}

async function carregarDadosKanban() {
    // Esta função irá buscar os canais e as tarefas do Supabase
    // e renderizá-los na tela.
    console.log("Carregando dados do Supabase para o Kanban...");
    
    // (Implementação futura)
}

async function handleFormSubmit(event) {
    event.preventDefault();
    console.log("Formulário enviado!");
    
    // Lógica para salvar ou atualizar tarefa no Supabase
    // e fazer upload de arquivo, se houver.
    
    // (Implementação futura)
}

// =============================================
//      FUNÇÕES DE EXEMPLO (A SEREM IMPLEMENTADAS)
// =============================================
/*
Exemplo de como buscaremos os canais no futuro:

async function getChannels() {
    const { data, error } = await supabaseClient
        .from('mkt_channels')
        .select('*');
    
    if (error) {
        console.error('Erro ao buscar canais:', error);
        return [];
    }
    return data;
}

Exemplo de como criaremos uma tarefa:

async function createTask(taskData) {
    const { data, error } = await supabaseClient
        .from('mkt_tasks')
        .insert([taskData])
        .select();

    if (error) {
        console.error('Erro ao criar tarefa:', error);
        return null;
    }
    return data[0];
}
*/

