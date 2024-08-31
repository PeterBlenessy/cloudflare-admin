import { ref, watch } from 'vue';
import { defineStore } from 'pinia';

export const useSettingsStore = defineStore('settings', () => {

    // Helper functions to save and load state from local storage
    const saveState = (key, state) => {
        localStorage.setItem(key, JSON.stringify(state));
    }
    
    const loadState = (key) => {
        const state = localStorage.getItem(key);
        return state ? JSON.parse(state) : null;
    }

    // Load initial state from local storage
    const darkMode = ref(loadState('darkMode') || false);
    const cfAccountId = ref(loadState('cfAccountId') || '');
    const cfApiKey = ref(loadState('cfApiKey') || '');
    const cfNamespaceId = ref(loadState('cfNamespaceId') || '');
    const cfNamespaceKeys = ref(loadState('cfNamespaceKeys') || []);
    const cfKeysCursor = ref(loadState('cfKeysCursor') || '');
    const cfKeyValuePairs = ref(loadState('cfKeyValuePairs') || []);

    // Watch and save changes to local storage
    watch(darkMode, (newValue) => saveState('darkMode', newValue), { deep: true });
    watch(cfAccountId, (newValue) => saveState('cfAccountId', newValue), { deep: true });
    watch(cfApiKey, (newValue) => saveState('cfApiKey', newValue), { deep: true });
    watch(cfNamespaceId, (newValue) => saveState('cfNamespaceId', newValue), { deep: true });
    watch(cfNamespaceKeys, (newValue) => saveState('cfNamespaceKeys', newValue), { deep: true });
    watch(cfKeysCursor, (newValue) => saveState('cfKeysCursor', newValue), { deep: true });
    watch(cfKeyValuePairs, (newValue) => saveState('cfKeyValuePairs', newValue), { deep: true });

    return {
        darkMode,
        cfAccountId,
        cfApiKey,
        cfNamespaceId,
        cfNamespaceKeys,
        cfKeysCursor,
        cfKeyValuePairs
    }
});