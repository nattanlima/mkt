// =================================================================================
// MARKETING HUB - API (Supabase)
// Versão 2.0 Refatorada
// =================================================================================

import { CONFIG } from './config.js';
import { state, invalidateFilterCache } from './state.js';
import { showToast, showSyncToast, sanitizeFileName } from './utils.js';

// Inicializa cliente Supabase
const { createClient } = supabase;
export const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// =================================================================================
// ERROR HANDLING
// =================================================================================
export function handleSupabaseError(error, context) {
    console.error(`Erro em ${context}:`, error);
    showToast(`Ocorreu um erro: ${error.message}`, 'error');
}

// =================================================================================
// AUTHENTICATION
// =================================================================================
export async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
}

export async function getSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

export async function getUserProfile(email) {
    const { data, error } = await supabaseClient
        .from('mkt_users')
        .select('*')
        .eq('email', email)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

export async function upsertUserProfile(userData) {
    const { data, error } = await supabaseClient
        .from('mkt_users')
        .upsert(userData)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export function onAuthStateChange(callback) {
    return supabaseClient.auth.onAuthStateChange(callback);
}

// =================================================================================
// DATA FETCHING
// =================================================================================
export async function fetchMarketingClients() {
    const { data: clientTags, error: tagsError } = await supabaseClient
        .from('cliente_tags')
        .select('id_cliente')
        .eq('id_tag', 'TAG-03');

    if (tagsError) {
        handleSupabaseError(tagsError, 'buscar tags de cliente');
        return [];
    }

    const clientIds = clientTags.map(ct => ct.id_cliente);
    if (clientIds.length === 0) return [];

    const { data, error } = await supabaseClient
        .from('clientes')
        .select('id_cliente, nome_empresa, postagens_mensais, storys_mensais, demanda_offline')
        .in('id_cliente', clientIds);

    if (error) {
        handleSupabaseError(error, 'buscar clientes');
        return [];
    }

    return data || [];
}

export async function fetchGlobalData() {
    const [channelsRes, statusRes, usersRes, tagsRes, taskTagsRes, taskFilesRes, ideasRes, tasksRes] = await Promise.all([
        supabaseClient.from('mkt_channels').select('*'),
        supabaseClient.from('mkt_status').select('*').order('order', { ascending: true }),
        supabaseClient.from('mkt_users').select('id, name, photo_url'),
        supabaseClient.from('mkt_tags').select('*'),
        supabaseClient.from('mkt_task_tags').select('*'),
        supabaseClient.from('mkt_task_files').select('*'),
        supabaseClient.from('mkt_ideas').select('*'),
        supabaseClient.from('mkt_tasks').select('*'),
    ]);

    const clients = await fetchMarketingClients();

    return {
        channels: channelsRes.data || [],
        status: statusRes.data || [],
        users: usersRes.data || [],
        tags: tagsRes.data || [],
        taskTags: taskTagsRes.data || [],
        taskFiles: taskFilesRes.data || [],
        ideas: ideasRes.data || [],
        tasks: tasksRes.data || [],
        clients
    };
}

// =================================================================================
// TASKS CRUD
// =================================================================================
export async function createTask(taskData) {
    const { data, error } = await supabaseClient
        .from('mkt_tasks')
        .insert(taskData)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateTask(taskId, taskData) {
    const { data, error } = await supabaseClient
        .from('mkt_tasks')
        .update(taskData)
        .eq('id', taskId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteTask(taskId) {
    const { error } = await supabaseClient
        .from('mkt_tasks')
        .delete()
        .eq('id', taskId);

    if (error) throw error;
}

export async function updateTaskStatus(taskId, statusId) {
    const { error } = await supabaseClient
        .from('mkt_tasks')
        .update({ status_id: statusId })
        .eq('id', taskId);

    if (error) throw error;
}

// =================================================================================
// TASK TAGS
// =================================================================================
export async function saveTaskTags(taskId, selectedTagIds, existingTagIds) {
    const tagsToAdd = selectedTagIds.filter(id => !existingTagIds.includes(id));
    const tagsToRemove = existingTagIds.filter(id => !selectedTagIds.includes(id));

    if (tagsToRemove.length > 0) {
        await supabaseClient
            .from('mkt_task_tags')
            .delete()
            .eq('task_id', taskId)
            .in('tag_id', tagsToRemove);
    }

    if (tagsToAdd.length > 0) {
        const newRelations = tagsToAdd.map(tag_id => ({ task_id: taskId, tag_id }));
        await supabaseClient.from('mkt_task_tags').insert(newRelations);
    }
}

// =================================================================================
// LOGS
// =================================================================================
export async function createLog(taskId, userId, description) {
    await supabaseClient
        .from('mkt_logs')
        .insert([{ task_id: taskId, user_id: userId, description }]);
}

export async function getTaskLogs(taskId) {
    const { data } = await supabaseClient
        .from('mkt_logs')
        .select('*, mkt_users(name)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

    return data || [];
}

// =================================================================================
// FILES
// =================================================================================
export async function uploadFile(taskId, userId, file) {
    const cleanFileName = sanitizeFileName(file.name);
    const filePath = `${userId}/${taskId}/${Date.now()}-${cleanFileName}`;

    const { error: uploadError } = await supabaseClient.storage
        .from(CONFIG.STORAGE_BUCKET)
        .upload(filePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data: newFile, error: insertError } = await supabaseClient
        .from('mkt_task_files')
        .insert({ task_id: taskId, file_path: filePath, file_name: file.name })
        .select()
        .single();

    if (insertError) {
        // Limpa arquivo se falhar no banco
        await supabaseClient.storage.from(CONFIG.STORAGE_BUCKET).remove([filePath]);
        throw insertError;
    }

    return newFile;
}

export async function deleteFile(fileId, filePath) {
    const { error: storageError } = await supabaseClient.storage
        .from(CONFIG.STORAGE_BUCKET)
        .remove([filePath]);

    if (storageError) throw storageError;

    const { error: dbError } = await supabaseClient
        .from('mkt_task_files')
        .delete()
        .eq('id', fileId);

    if (dbError) throw dbError;
}

export function getFilePublicUrl(filePath) {
    const { data } = supabaseClient.storage
        .from(CONFIG.STORAGE_BUCKET)
        .getPublicUrl(filePath);

    return data.publicUrl;
}

// =================================================================================
// IDEAS
// =================================================================================
export async function fetchIdeas(userId) {
    const query = supabaseClient
        .from('mkt_ideas')
        .select('*')
        .order('created_at', { ascending: false });

    // Filtra por usuário se userId fornecido
    if (userId) {
        query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
}

export async function createIdea(userId, title = 'Nova Ideia') {
    const { data, error } = await supabaseClient
        .from('mkt_ideas')
        .insert({ title, content: '', user_id: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateIdea(ideaId, updates) {
    const { error } = await supabaseClient
        .from('mkt_ideas')
        .update(updates)
        .eq('id', ideaId);

    if (error) throw error;
}

export async function deleteIdea(ideaId) {
    const { error } = await supabaseClient
        .from('mkt_ideas')
        .delete()
        .eq('id', ideaId);

    if (error) throw error;
}

// =================================================================================
// TAGS
// =================================================================================
export async function createTag(name, color) {
    const { data, error } = await supabaseClient
        .from('mkt_tags')
        .insert([{ name, color }])
        .select();

    if (error) {
        if (error.code === '23505') {
            throw new Error(`A tag "${name}" já existe.`);
        }
        throw error;
    }

    return data?.[0];
}

export async function deleteTag(tagId) {
    const { error } = await supabaseClient
        .from('mkt_tags')
        .delete()
        .eq('id', parseInt(tagId));

    if (error) throw error;
}

// =================================================================================
// CLIENTS
// =================================================================================
export async function updateClientContract(clientId, contractData) {
    const { data, error } = await supabaseClient
        .from('clientes')
        .update(contractData)
        .eq('id_cliente', clientId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// =================================================================================
// BULK OPERATIONS
// =================================================================================
export async function createTasksBulk(tasks) {
    const { data, error } = await supabaseClient
        .from('mkt_tasks')
        .insert(tasks)
        .select();

    if (error) throw error;
    return data || [];
}

// =================================================================================
// REALTIME SUBSCRIPTIONS
// =================================================================================
let realtimeChannel = null;

export function initializeRealtimeListeners(onTaskChange, onFileChange, onTagsChange) {
    // Remove canais existentes
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient.channel('marketing-hub-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mkt_tasks' }, (payload) => {
            showSyncToast();
            onTaskChange(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mkt_task_files' }, (payload) => {
            showSyncToast();
            onFileChange(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mkt_task_tags' }, (payload) => {
            showSyncToast();
            onTagsChange(payload);
        })
        .subscribe();
}

export function removeAllRealtimeListeners() {
    supabaseClient.removeAllChannels();
    realtimeChannel = null;
}
