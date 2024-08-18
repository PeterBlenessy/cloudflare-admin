<template>
    <div>
        <v-card prepend-icon="mdi-cog-outline" title="Settings" class="mx-auto pa-12 pb-8" max-width="450">
            <v-text-field v-model="accountId" single-line density="compact" variant="outlined"
                placeholder="CF account Id" required prepend-inner-icon="mdi-account" />
            <v-text-field v-model="apiKey" single-line density="compact" variant="outlined" placeholder="CF API Key"
                required prepend-inner-icon="mdi-key" :type="visible ? 'text' : 'password'"
                :append-inner-icon="visible ? 'mdi-eye-off' : 'mdi-eye'" @click:append-inner="visible = !visible" />
            <v-text-field v-model="namespaceId" single-line density="compact" variant="outlined"
                placeholder="CF namespace Id" required prepend-inner-icon="mdi-database" />

            <v-card-actions>
                <v-spacer />
                <v-btn variant="tonal" color="primary" @click="saveSettings">Save</v-btn>
            </v-card-actions>
        </v-card>
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '../stores/settings-store.js';

const settingsStore = useSettingsStore();
const { cfAccountId, cfApiKey, cfNamespaceId } = storeToRefs(settingsStore);

const emit = defineEmits(['settings-saved']);

const accountId = ref('');
const namespaceId = ref('');
const apiKey = ref('');
const visible = ref(false);

const saveSettings = async () => {
    try {

        // Save settings to local storage
        cfAccountId.value = accountId.value;
        cfApiKey.value = apiKey.value;
        cfNamespaceId.value = namespaceId.value;

        // Emit an event or handle success as needed
        emit('settings-saved');
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
};

// Load settings on mounted
onMounted(() => {
    accountId.value = cfAccountId.value;
    apiKey.value = cfApiKey.value;
    namespaceId.value = cfNamespaceId.value;
});

</script>

<style scoped>
/* Add any component-specific styles here */
</style>