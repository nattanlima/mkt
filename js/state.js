// =================================================================================
// MARKETING HUB - STATE MANAGEMENT
// Versão 2.0 Refatorada
// =================================================================================

/**
 * Estado inicial da aplicação
 */
const initialState = {
    currentUser: null,
    channels: [],
    status: [],
    tasks: [],
    users: [],
    tags: [],
    taskTags: [],
    taskFiles: [],
    ideas: [],
    clients: [],
    currentPage: 'dashboard',
    dashboardFilters: { period: 'this_month' },
    pagesLoaded: { dashboard: false, kanban: false, calendar: false, ideas: false, clients: false },
    filters: { clientId: 'all', userId: 'all', channelId: 'all', tagId: 'all' },
    calendarView: 'month',
    currentDate: new Date(),
    activeIdeaId: null,
    isAppInitialized: false,
    authStateSubscription: null,
};

/**
 * Cache para filtros (evita recálculo desnecessário)
 */
let filteredTasksCache = {
    hash: null,
    result: []
};

/**
 * Listeners de mudança de estado
 */
const stateListeners = new Set();

/**
 * Estado da aplicação (proxy reativo)
 */
export const state = new Proxy({ ...initialState }, {
    set(target, property, value) {
        const oldValue = target[property];
        target[property] = value;

        // Invalida cache de filtros quando tasks ou filters mudam
        if (property === 'tasks' || property === 'filters') {
            invalidateFilterCache();
        }

        // Notifica listeners
        stateListeners.forEach(fn => {
            try {
                fn(property, value, oldValue);
            } catch (error) {
                console.error('Erro em state listener:', error);
            }
        });

        return true;
    }
});

/**
 * Inscreve um listener para mudanças de estado
 * @param {Function} fn - Callback (property, newValue, oldValue)
 * @returns {Function} - Função para cancelar inscrição
 */
export function subscribeToState(fn) {
    stateListeners.add(fn);
    return () => stateListeners.delete(fn);
}

/**
 * Invalida o cache de tarefas filtradas
 */
export function invalidateFilterCache() {
    filteredTasksCache = { hash: null, result: [] };
}

/**
 * Obtém tarefas filtradas com cache
 * @returns {Array}
 */
export function getFilteredTasks() {
    const { clientId, userId, channelId, tagId } = state.filters;
    const currentHash = `${clientId}-${userId}-${channelId}-${tagId}-${state.tasks.length}-${state.taskTags.length}`;

    // Retorna cache se válido
    if (filteredTasksCache.hash === currentHash) {
        return filteredTasksCache.result;
    }

    // Calcula novo resultado
    let filtered = [...state.tasks];

    if (clientId !== 'all' && clientId) {
        filtered = filtered.filter(task => task.client_id == clientId);
    }
    if (userId !== 'all' && userId) {
        filtered = filtered.filter(task => task.assignee_id == userId);
    }
    if (channelId !== 'all' && channelId) {
        filtered = filtered.filter(task => task.channel_id == channelId);
    }
    if (tagId !== 'all' && tagId) {
        const tasksWithTag = state.taskTags
            .filter(tt => tt.tag_id == tagId)
            .map(tt => tt.task_id);
        filtered = filtered.filter(task => tasksWithTag.includes(task.id));
    }

    // Atualiza cache
    filteredTasksCache = { hash: currentHash, result: filtered };

    return filtered;
}

/**
 * Atualiza uma tarefa no estado (update parcial)
 * @param {number} taskId - ID da tarefa
 * @param {Object} updates - Campos a atualizar
 * @returns {Object|null} - Tarefa atualizada ou null
 */
export function updateTaskInState(taskId, updates) {
    const index = state.tasks.findIndex(t => t.id == taskId);
    if (index === -1) return null;

    state.tasks[index] = { ...state.tasks[index], ...updates };
    invalidateFilterCache();

    return state.tasks[index];
}

/**
 * Remove uma tarefa do estado
 * @param {number} taskId - ID da tarefa
 * @returns {boolean}
 */
export function removeTaskFromState(taskId) {
    const initialLength = state.tasks.length;
    state.tasks = state.tasks.filter(t => t.id != taskId);
    invalidateFilterCache();

    return state.tasks.length < initialLength;
}

/**
 * Adiciona uma tarefa ao estado
 * @param {Object} task - Tarefa a adicionar
 */
export function addTaskToState(task) {
    state.tasks.push(task);
    invalidateFilterCache();
}

/**
 * Reseta o estado da aplicação
 */
export function resetState() {
    Object.keys(initialState).forEach(key => {
        if (key === 'currentDate') {
            state[key] = new Date();
        } else if (typeof initialState[key] === 'object' && initialState[key] !== null) {
            state[key] = Array.isArray(initialState[key]) ? [] : { ...initialState[key] };
        } else {
            state[key] = initialState[key];
        }
    });
    invalidateFilterCache();
}

/**
 * Aplica um filtro e invalida cache
 * @param {string} key - Chave do filtro
 * @param {string} value - Valor do filtro
 */
export function applyFilter(key, value) {
    state.filters = { ...state.filters, [key]: value };
}

/**
 * Limpa todos os filtros
 */
export function clearFilters() {
    state.filters = { clientId: 'all', userId: 'all', channelId: 'all', tagId: 'all' };
}
