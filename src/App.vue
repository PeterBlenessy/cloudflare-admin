<script setup>
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup
import { computed, onMounted, ref, watch } from "vue";
import KeyValuePairs from "./components/KeyValuePairs.vue";
import Settings from "./components/Settings.vue";
import Updater from "./components/Updater.vue";
import { cfVerifyApiKey } from "./api/cloudflare.js";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "./stores/settings-store.js";
import { useTheme } from "vuetify";
import { useUpdater } from "./composables/useUpdater.js";

const {
    checkForUpdates,
    downloadAndInstall,
    downloaded,
    contentLength,
    relaunchApp,
} = useUpdater();

const settingsStore = useSettingsStore();
const { cfApiKey, darkMode, isValidApiKey } = storeToRefs(settingsStore);

const theme = useTheme();

const showSettingsDialog = ref(false);
const updaterStatus = ref(false);
const isUpdateAvailable = ref(false);
const updaterTooltip = ref("Check for updates");
let newUpdate = null;

const cfLogo = computed(
    () =>
        new URL(
            `./assets/CF_logomark${isValidApiKey.value ? "" : theme.global.current.value.dark ? "_white" : "_black"}.svg`,
            import.meta.url,
        ).href,
);
onMounted(() => {
    theme.global.name.value = darkMode.value ? "dark" : "light";
});
onMounted(async () => {
    isValidApiKey.value = await cfVerifyApiKey(cfApiKey.value);
});
onMounted(() => {
    checkForUpdates().then((update) => {
        if (update) {
            isUpdateAvailable.value = true;
            newUpdate = update;
            updaterTooltip.value = `Download and install version ${update.version}`;
        }
    });
});
watch(cfApiKey, async () => {
    isValidApiKey.value = await cfVerifyApiKey(cfApiKey.value);
});
watch(darkMode, () => {
    theme.global.name.value = darkMode.value ? "dark" : "light";
});

const progress = ref(0);
watch(downloaded, () => {
    progress.value = Math.round((downloaded.value / contentLength.value) * 100);
    if (progress.value == 100) {
        updaterTooltip.value = "Relaunch application";
    }
});

const handleClickUpdateButton = () => {
    if (isUpdateAvailable.value && progress.value == 0) {
        downloadAndInstall(newUpdate);
    } else if (progress.value == 100) {
        relaunchApp();
    } else if (!isUpdateAvailable.value) {
        updaterStatus.value = true;
    }
};
</script>

<template>
    <v-layout class="rounded rounded-md">
        <v-app-bar title="Cloudflare admin">
            <template v-slot:append>
                <v-tooltip
                    location="bottom center"
                    text="Cloudflare API settings"
                >
                    <template v-slot:activator="{ props }">
                        <v-btn
                            v-bind="props"
                            @click.stop="showSettingsDialog = true"
                            :color="isValidApiKey ? 'orange-darken-2' : ''"
                            :append-icon="
                                isValidApiKey ? 'mdi-link' : 'mdi-link-off'
                            "
                        >
                            <v-img :src="cfLogo" width="30" />
                        </v-btn>
                    </template>
                </v-tooltip>

                <v-tooltip location="bottom center" text="Toggle dark mode">
                    <template v-slot:activator="{ props }">
                        <v-btn
                            v-bind="props"
                            icon="mdi-theme-light-dark"
                            @click="darkMode = !darkMode"
                        />
                    </template>
                </v-tooltip>

                <v-tooltip location="bottom center" :text="updaterTooltip">
                    <template v-slot:activator="{ props }">
                        <v-btn
                            v-if="progress == 0"
                            v-bind="props"
                            icon="mdi-download"
                            :color="isUpdateAvailable ? 'orange darken-2' : ''"
                            @click.stop="handleClickUpdateButton()"
                        />
                        <v-btn
                            v-else-if="progress == 100"
                            v-bind="props"
                            icon="mdi-restart"
                            color="orange darken-2"
                            @click.stop="handleClickUpdateButton()"
                        />
                        <v-progress-circular
                            v-else-if="progress != 0"
                            color="orange-darken-2"
                            :model-value="progress"
                        >
                        </v-progress-circular>
                    </template>
                </v-tooltip>
            </template>
        </v-app-bar>
        <v-main
            class="d-flex align-center justify-center"
            style="min-height: 300px"
        >
            <!-- Key-value pairs -->
            <KeyValuePairs />

            <v-snackbar v-model="snackbar" vertical>
                <div class="text-subtitle-1 pb-2">
                    This is a snackbar message
                </div>

                <p>This is a longer paragraph explaining something</p>

                <template v-slot:actions>
                    <v-btn
                        color="indigo"
                        variant="text"
                        @click="snackbar = false"
                    >
                        Close
                    </v-btn>
                </template>
            </v-snackbar>
        </v-main>

        <Settings v-model="showSettingsDialog" />

        <Updater v-model="updaterStatus" />
    </v-layout>
</template>

<style scoped></style>
