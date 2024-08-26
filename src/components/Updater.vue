<template>
    <div> {{ isUpdating }} </div>
        <v-snackbar v-model="showNotification" :timeout="timeout" timer>
            {{ text }}

            <template v-slot:actions>
                <v-btn variant="text" @click="showNotification = false">
                    Close
                </v-btn>
            </template>
        </v-snackbar>

</template>

<script setup>
import {ref, watch } from 'vue';
import { useUpdater } from '../composables/useUpdater.js';

const { checkForUpdates } = useUpdater();
const timeout = ref(5000);
const showNotification = ref(false);
const text = ref('Checking for updates...');

const isUpdating = defineModel({ default: false });

watch(isUpdating, async () => {
    if (isUpdating) {
        showNotification.value = true;
        checkForUpdates().then(update => {
            text.value = update ? 'Update available' : 'No updates available';
        }).catch((error) => {
            text.value='Update failed';
        }).finally(() => {
            isUpdating.value = false;
        });
    }
});

</script>