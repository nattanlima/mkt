// =================================================================================
// MARKETING HUB - UTILITIES
// Versão 2.0 Refatorada
// =================================================================================

import { CONFIG } from './config.js';

/**
 * Debounce - Atrasa a execução de uma função até que pare de ser chamada
 * @param {Function} fn - Função a ser debounced
 * @param {number} delay - Delay em ms
 * @returns {Function}
 */
export function debounce(fn, delay = CONFIG.DEBOUNCE_DELAY) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Throttle - Limita a frequência de execução de uma função
 * @param {Function} fn - Função a ser throttled
 * @param {number} limit - Intervalo mínimo em ms
 * @returns {Function}
 */
export function throttle(fn, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Executa uma função com tratamento de erro
 * @param {Function} fn - Função a executar
 * @param {string} context - Contexto para log de erro
 * @param {*} fallback - Valor de retorno em caso de erro
 * @returns {Promise<*>}
 */
export async function safeExecute(fn, context, fallback = null) {
    try {
        return await fn();
    } catch (error) {
        console.error(`Erro em ${context}:`, error);
        showToast(`Ocorreu um erro: ${error.message}`);
        return fallback;
    }
}

/**
 * Mostra um toast de notificação
 * @param {string} message - Mensagem
 * @param {string} type - Tipo: 'normal' | 'success' | 'error'
 */
export function showToast(message, type = 'normal') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'fixed bottom-5 right-5 text-white py-3 px-5 rounded-lg shadow-lg transition-all duration-300 z-50 font-semibold';

    switch (type) {
        case 'success':
            toast.classList.add('bg-emerald-500');
            break;
        case 'error':
            toast.classList.add('bg-red-500');
            break;
        default:
            toast.classList.add('bg-gray-900');
    }

    toast.classList.remove('opacity-0', 'translate-y-2');
    setTimeout(() => toast.classList.add('opacity-0', 'translate-y-2'), CONFIG.TOAST_DURATION);
}

/**
 * Mostra toast de sincronização
 */
export function showSyncToast() {
    const toast = document.getElementById('sync-toast');
    if (!toast) return;

    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), CONFIG.SYNC_TOAST_DURATION);
}

/**
 * Formata data para exibição em logs
 * @param {string} dateString - Data ISO
 * @returns {string}
 */
export function formatLogDate(dateString) {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Obtém cor de contraste (preto ou branco) baseado na cor de fundo
 * @param {string} colorString - Cor em formato hex ou hsl
 * @returns {string}
 */
export function getContrastColor(colorString) {
    if (!colorString) return '#020617';

    if (colorString.startsWith('hsl')) {
        const lightness = parseInt(colorString.split(',')[2].replace('%', ''));
        return lightness > 65 ? '#020617' : '#FFFFFF';
    }

    let hex = colorString.slice(1);
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    return yiq >= 128 ? '#020617' : '#FFFFFF';
}

/**
 * Gera cor pastel baseada em uma seed (nome)
 * @param {string} seed - String para gerar cor
 * @returns {string}
 */
export function generatePastelColor(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, 70%, 85%)`;
}

/**
 * Sanitiza nome de arquivo removendo caracteres especiais
 * @param {string} fileName - Nome original do arquivo
 * @returns {string}
 */
export function sanitizeFileName(fileName) {
    // Remove acentos
    const nameWithoutAccents = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Substitui espaços e caracteres especiais por underline
    return nameWithoutAccents.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Alterna estado de loading em um botão
 * @param {HTMLButtonElement} button - Botão
 * @param {boolean} isLoading - Estado de loading
 */
export function toggleButtonLoading(button, isLoading) {
    if (!button) return;

    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.innerHTML;
    }
}

/**
 * Escapa HTML para prevenir XSS
 * @param {string} str - String para escapar
 * @returns {string}
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Cria elemento DOM a partir de template string
 * @param {string} html - HTML string
 * @returns {Element}
 */
export function htmlToElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

/**
 * Remove todos os filhos de um elemento (mais eficiente que innerHTML = '')
 * @param {Element} element - Elemento pai
 */
export function clearChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Memoização simples para funções puras
 * @param {Function} fn - Função a ser memoizada
 * @returns {Function}
 */
export function memoize(fn) {
    const cache = new Map();
    return function (...args) {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn.apply(this, args);
        cache.set(key, result);
        return result;
    };
}
