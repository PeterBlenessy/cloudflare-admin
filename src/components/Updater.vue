<template>
    <v-dialog v-model="isUpdating" max-width="350px" persistent>
        <div>
            <v-card :title="title" class="pa-2" max-width="350" prepend-icon="mdi-download">
                <template v-slot:append>
                    <v-progress-circular v-show="status == 'checking'" color="primary" indeterminate="disable-shrink"
                        size="24" width="3" />
                </template>

                <v-card-text v-if="status == 'available'" density="compact">
                    <div>Version: {{ version }}</div>
                    <div>Release date: {{ releaseDate }}</div>

                    <!-- Generate a bulleted list -->
                    <v-card>
                        <v-card-text>
                            <ul v-for="note in releaseNotes" :key="note">
                                <li>{{ note }}</li>
                            </ul>
                        </v-card-text>
                    </v-card>

                </v-card-text>
                <v-card-actions>
                    <v-btn variant="plain" text="Cancel" @click="isUpdating = false" />
                    <v-spacer />
                    <v-btn v-show="status == 'available'" variant="tonal" color="primary" text="Update"
                        @click="download()" />
                </v-card-actions>
            </v-card>
        </div>
    </v-dialog>

</template>

<script setup>
import { ref, watch } from 'vue';
import { useUpdater } from '../composables/useUpdater.js';

const { checkForUpdates, download } = useUpdater();

const title = ref('Checking for updates');
const text = ref('');
const releaseDate = ref('');
const version = ref('');
const releaseNotes = ref([]);
const isUpdating = defineModel({ default: false });
const status = ref('');



watch(isUpdating, async () => {
    if (isUpdating) {
        status.value = 'checking';
        checkForUpdates().then(update => {
            if (update) {
                status.value = 'available';
                title.value = 'Update available';
                text.value = update.body;

                releaseDate.value = update.date.split(' ')[0];
                version.value = update.version;
                releaseNotes.value = update.body.split('- ');
                // trim whitespaces in releasenotes and remove empty strings
                releaseNotes.value = releaseNotes.value.map(note => note.trim()).filter(note => note);

            } else {
                status.value = 'not-available';
                title.value = 'No updates available';
            }
        }).catch((error) => {
            text.value = 'Update failed';
        }).finally(() => {
            // isUpdating.value = false;
        });
    }
});

</script>