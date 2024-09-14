<template>
    <v-dialog
        v-model="updaterStatus"
        max-width="350px"
        scroll-strategy="block"
        :persistent="status == 'updating'"
    >
        <div>
            <v-card :title="states[status].title" class="pa-2" max-width="450">
                <template v-slot:append>
                    <v-tooltip
                        location="bottom center"
                        :text="states[status].tooltip"
                    >
                        <template v-slot:activator="{ props }">
                            <v-btn
                                v-if="status != 'updating'"
                                v-bind="props"
                                density="comfortable"
                                variant="text"
                                :color="states[status].color"
                                :icon="states[status].icon"
                                :loading="states[status].loading"
                                @click="states[status].onClick()"
                            />

                            <v-progress-circular
                                v-if="status == 'updating'"
                                :color="states[status].color"
                                :model-value="progress"
                            >
                            </v-progress-circular>
                        </template>
                    </v-tooltip>
                </template>

                <v-card-text v-if="status == 'available'" density="compact">
                    <div class="text-caption">Version: {{ version }}</div>
                    <div class="text-caption">
                        Release date: {{ releaseDate }}
                    </div>
                    <div class="text-overline mt-2">Release notes</div>
                    <div class="text-caption">
                        <ul
                            v-for="note in releaseNotes"
                            :key="note"
                            class="pl-4"
                        >
                            <li>{{ note }}</li>
                        </ul>
                    </div>
                </v-card-text>
            </v-card>
        </div>
    </v-dialog>
</template>

<script setup>
import { ref, watch } from "vue";
import { useUpdater } from "../composables/useUpdater.js";

const {
    checkForUpdates,
    downloadAndInstall,
    downloaded,
    contentLength,
    relaunchApp,
} = useUpdater();

const updaterStatus = defineModel({ default: false });

const text = ref("");
const releaseDate = ref("");
const version = ref("");
const releaseNotes = ref([]);
const status = ref("");
let newUpdate = null;

// Updater dialog properties for updater statuses
const states = ref({
    checking: {
        title: "Checking for updates",
        icon: "mdi-download",
        loading: true,
        color: "",
        tooltip: "Cancel",
        onClick: () => {
            updaterStatus.value = false;
        },
    },
    available: {
        title: "Update available",
        icon: "mdi-download",
        loading: false,
        color: "orange-darken-2",
        tooltip: "Download and install",
        onClick: () => {
            status.value = "updating";
            downloadAndInstall(newUpdate);
        },
    },
    notAvailable: {
        title: "No updates available",
        icon: "mdi-close",
        loading: false,
        color: "",
        tooltip: "Close",
        onClick: () => {
            updaterStatus.value = false;
        },
    },
    failed: {
        title: "Update failed",
        icon: "mdi-alert",
        loading: false,
        color: "",
        tooltip: "Close",
        onClick: () => {
            updaterStatus.value = false;
        },
    },
    updating: {
        title: "Downloading and installing",
        icon: "",
        loading: false,
        color: "orange-darken-2",
        tooltip: "Installing update",
        onClick: () => {},
    },
    finished: {
        title: "Installed, ready to relaunch",
        icon: "mdi-restart",
        loading: false,
        color: "orange-darken-2",
        tooltip: "Relaunch application",
        onClick: () => {
            relaunchApp();
        },
    },
});

const progress = ref(0);

watch(downloaded, () => {
    progress.value = Math.round((downloaded.value / contentLength.value) * 100);
    if (progress.value == 100) {
        status.value = "finished";
    }
});

watch(updaterStatus, async () => {
    if (updaterStatus.value) {
        status.value = "checking";
        checkForUpdates()
            .then((update) => {
                if (update) {
                    status.value = "available";
                    newUpdate = update;
                    text.value = update.body;

                    releaseDate.value = update.date.split(" ")[0];
                    version.value = update.version;
                    releaseNotes.value = update.body.split("- ");
                    // trim whitespaces in releasenotes and remove empty strings
                    releaseNotes.value = releaseNotes.value
                        .map((note) => note.trim())
                        .filter((note) => note);
                } else {
                    status.value = "notAvailable";
                }
            })
            .catch((error) => {
                status.value = "failed";
                console.log("Error checking for updates:", error);
            });
    }
});
</script>
