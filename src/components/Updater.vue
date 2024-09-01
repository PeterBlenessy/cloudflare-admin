<template>
    <v-dialog v-model="isUpdating" max-width="350px" persistent scroll-strategy="block">
        <div>
            <v-card :title="states[status].title" class="pa-2" max-width="350">
                <template v-slot:append>
                    <v-tooltip location="bottom center" :text="states[status].tooltip">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" :icon="states[status].icon" :loading="states[status].loading"
                                @click="states[status].onClick()" density="comfortable" variant="plain" />
                        </template>
                    </v-tooltip>
                </template>

                <v-card-text v-if="status == 'available'" density="compact">
                    <v-card>
                        <v-card-text>
                            <div>Version: {{ version }}</div>
                            <div>Release date: {{ releaseDate }}</div>
                            <div>Release notes:</div>
                            <div>
                                <ul v-for="note in releaseNotes" :key="note">
                                    <li>{{ note }}</li>
                                </ul>
                            </div>
                        </v-card-text>
                    </v-card>

                </v-card-text>
            </v-card>
        </div>
    </v-dialog>

</template>

<script setup>
import { ref, watch } from 'vue';
import { useUpdater } from '../composables/useUpdater.js';

const { checkForUpdates, downloadAndInstall } = useUpdater();

const text = ref('');
const releaseDate = ref('');
const version = ref('');
const releaseNotes = ref([]);
const isUpdating = defineModel({ default: false });
const status = ref('');
let newUpdate = null;

// Updater dialog properties for updater statuses
const states = ref({
    'checking': {
        title: 'Checking for updates',
        icon: 'mdi-download',
        loading: true,
        tooltip: 'Cancel',
        onClick: () => { isUpdating.value = false }
    },
    'available': {
        title: 'Update available',
        icon: 'mdi-download',
        loading: false,
        tooltip: 'Download and install',
        onClick: () => downloadAndInstall(newUpdate)
    },
    'notAvailable': {
        title: 'No updates available',
        icon: 'mdi-close',
        loading: false,
        tooltip: 'Close',
        onClick: () => { isUpdating.value = false }
    },
    'failed': {
        title: 'Update failed',
        icon: 'mdi-alert',
        loading: false,
        tooltip: 'Close',
        onClick: () => { isUpdating.value = false }
    }

});

watch(isUpdating, async () => {
    if (isUpdating.value) {
        status.value = 'checking';
        checkForUpdates().then(update => {
            if (update) {
                status.value = 'available';
                newUpdate = update;
                text.value = update.body;

                releaseDate.value = update.date.split(' ')[0];
                version.value = update.version;
                releaseNotes.value = update.body.split('- ');
                // trim whitespaces in releasenotes and remove empty strings
                releaseNotes.value = releaseNotes.value.map(note => note.trim()).filter(note => note);
            } else {
                status.value = 'notAvailable';
            }
        }).catch((error) => {
            status.value = 'failed';
            console.log('Error checking for updates:', error);
        });
    }
});

</script>