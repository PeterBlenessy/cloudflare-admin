<template>
    <v-dialog v-model="isDialogActive" max-width="500px" persistent>
        <div>
            <v-card title="Settings" prepend-icon="mdi-cog-outline" class="mx-auto pa-12 pb-8" max-width="450">
                <v-text-field v-model="accountId" single-line density="compact" variant="outlined"
                    placeholder="CF account Id" required prepend-inner-icon="mdi-account" />
                <v-text-field v-model="apiKey" single-line density="compact" variant="outlined" placeholder="CF API Key"
                    required prepend-inner-icon="mdi-key" :type="apiKeyVisible ? 'text' : 'password'"
                    :append-inner-icon="apiKeyVisible ? 'mdi-eye-off' : 'mdi-eye'"
                    @click:append-inner="apiKeyVisible = !apiKeyVisible" />
                <v-text-field v-model="namespaceId" single-line density="compact" variant="outlined"
                    placeholder="CF namespace Id" required prepend-inner-icon="mdi-database" />

                <v-card-actions>
                    <v-spacer />
                    <v-btn color="blue darken-1" text @click="closeDialog">Close</v-btn>
                    <v-btn variant="tonal" color="primary" @click="saveSettings">Save</v-btn>
                </v-card-actions>
            </v-card>
        </div>
    </v-dialog>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useSettingsStore } from '../stores/settings-store.js';

const settingsStore = useSettingsStore();
const { cfAccountId, cfApiKey, cfNamespaceId } = storeToRefs(settingsStore);

const accountId = ref('');
const namespaceId = ref('');
const apiKey = ref('');
const apiKeyVisible = ref(false);

// Shared model between parent and child component
// https://vuejs.org/guide/components/v-model.html
const isDialogActive = defineModel({ default: false });

const closeDialog = () => { isDialogActive.value = false; }

const saveSettings = async () => {
    cfAccountId.value = accountId.value;
    cfApiKey.value = apiKey.value;
    cfNamespaceId.value = namespaceId.value;

    console.log('Successfully saved settings');

    // Close the dialog
    closeDialog();
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