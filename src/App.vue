<script setup>
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup
import { computed, onMounted, ref, watch } from 'vue';
import KeyValuePairs from "./components/KeyValuePairs.vue";
import Settings from "./components/Settings.vue";
import Updater from './components/Updater.vue';
import { cfVerifyApiKey } from "./api/cloudflare.js";
import { storeToRefs } from 'pinia';
import { useSettingsStore } from './stores/settings-store.js';
import { useTheme } from 'vuetify';
import { useUpdater } from './composables/useUpdater.js';

const { checkForUpdates, downloadAndInstall } = useUpdater();

const settingsStore = useSettingsStore();
const { cfApiKey, darkMode } = storeToRefs(settingsStore);

const theme = useTheme();

const isValidApiKey = ref(false);
const showSettingsDialog = ref(false);
const isUpdating = ref(false);
const isUpdateAvailable = ref(false);
const updaterTooltip = ref('Check for updates');
let newUpdate = null;

const cfLogo = computed(() => new URL(`./assets/CF_logomark${isValidApiKey.value ? '' : (theme.global.current.value.dark ? '_white' : '_black')}.svg`, import.meta.url).href);
onMounted(() => { theme.global.name.value = darkMode.value ? 'dark' : 'light'; });
onMounted(async () => { isValidApiKey.value = await cfVerifyApiKey(cfApiKey.value); });
onMounted(() => {
    checkForUpdates().then(update => {
        if (update) {
            isUpdateAvailable.value = true;
            newUpdate = update;
            updaterTooltip.value = `Click to update to version ${update.version}`;
        }
    });
});
watch(cfApiKey, async () => { isValidApiKey.value = await cfVerifyApiKey(cfApiKey.value); });
watch(darkMode, () => { theme.global.name.value = darkMode.value ? 'dark' : 'light'; });

const handleClickUpdateButton = () => {
    if (isUpdateAvailable.value) {
        downloadAndInstall(newUpdate);
    } else {
        isUpdating.value = true;
    }
}
</script>

<template>
    <v-layout class="rounded rounded-md">
        <v-app-bar title="Cloudflare admin">
            <template v-slot:append>
                <v-btn @click.stop="showSettingsDialog = true" color="orange-darken-2"
                    :append-icon="isValidApiKey ? 'mdi-link' : 'mdi-link-off'">

                    <v-img :src="cfLogo" width="30" />
                </v-btn>

                <v-btn icon="mdi-theme-light-dark" @click="darkMode = !darkMode" />

                <v-tooltip location="bottom center" :text="updaterTooltip">
                    <template v-slot:activator="{ props }">
                        <v-btn v-bind="props" icon="mdi-download" @click.stop="handleClickUpdateButton()"
                        :color="isUpdateAvailable ? 'orange darken-2' : ''" />
                    </template>
                </v-tooltip>

            </template>
        </v-app-bar>
        <v-main class="d-flex align-center justify-center" style="min-height: 300px;">
            <!-- Key-value pairs -->
            <KeyValuePairs />
        </v-main>

        <!-- Settings dialog -->
        <!-- showSettingsDialog is shared between parent and child component -->
        <!-- Reference: https://blog.bitsrc.io/vue-js-3-3s-definemodel-enhancing-parent-child-component-communication-d43eca5cb089 -->
        <Settings v-model="showSettingsDialog" />

        <Updater v-model="isUpdating" />

    </v-layout>
</template>

<style scoped></style>
