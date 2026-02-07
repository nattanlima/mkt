// =================================================================================
// MARKETING HUB - CONFIGURATION
// Versão 2.0 Refatorada
// =================================================================================

export const CONFIG = {
    SUPABASE_URL: 'https://ccenxfyqwtfpexltuwrn.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZW54Znlxd3RmcGV4bHR1d3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzE1MTMsImV4cCI6MjA2ODg0NzUxM30.6un31sODuCyd5Dz_pR_kn656k74jjh5CNAfF0YteT7I',
    STORAGE_BUCKET: 'mk_files',
    DEBOUNCE_DELAY: 300,
    TOAST_DURATION: 3000,
    SYNC_TOAST_DURATION: 3000,
};

// Status names para comparação (normalizados para lowercase)
export const STATUS_NAMES = {
    TODO: 'a fazer',
    IN_PROGRESS: 'em progresso',
    APPROVED: 'aprovado',
    DONE: 'concluido',
};

// Configurações de páginas
export const PAGE_IDS = {
    DASHBOARD: 'dashboard',
    CLIENTS: 'clients',
    IDEAS: 'ideas',
    KANBAN: 'kanban',
    CALENDAR: 'calendar',
};

// Elementos DOM frequentemente acessados (cache)
export const DOM_CACHE = {
    // Será populado na inicialização
};

export function initDOMCache() {
    DOM_CACHE.appContainer = document.getElementById('main-app-container');
    DOM_CACHE.loginScreen = document.getElementById('login-screen');
    DOM_CACHE.mainContentArea = document.getElementById('main-content-area');
    DOM_CACHE.headerActions = document.getElementById('header-actions');
    DOM_CACHE.filterBar = document.getElementById('filter-bar');
    DOM_CACHE.toast = document.getElementById('toast');
    DOM_CACHE.syncToast = document.getElementById('sync-toast');
    DOM_CACHE.userMenuBtn = document.getElementById('user-menu-btn');
    DOM_CACHE.logoutPopup = document.getElementById('logout-popup');

    // Filtros
    DOM_CACHE.clientFilter = document.getElementById('client-filter');
    DOM_CACHE.userFilter = document.getElementById('user-filter');
    DOM_CACHE.channelFilter = document.getElementById('channel-filter');
    DOM_CACHE.tagFilter = document.getElementById('tag-filter');

    // Forms
    DOM_CACHE.loginForm = document.getElementById('login-form');
    DOM_CACHE.taskForm = document.getElementById('task-form');
    DOM_CACHE.contractForm = document.getElementById('contract-form');
    DOM_CACHE.generateTasksForm = document.getElementById('generate-tasks-form');

    // Pages
    DOM_CACHE.dashboardPage = document.getElementById('dashboard-page');
    DOM_CACHE.clientsPage = document.getElementById('clients-page');
    DOM_CACHE.ideasPage = document.getElementById('ideas-page');
    DOM_CACHE.kanbanPage = document.getElementById('kanban-page');
    DOM_CACHE.calendarPage = document.getElementById('calendar-page');
    DOM_CACHE.kanbanBoard = document.getElementById('kanban-board');
}
