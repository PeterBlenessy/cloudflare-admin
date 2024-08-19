<script setup>
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup
import { computed, onMounted, ref, watch } from 'vue';
import KeyValuePairs from "./components/KeyValuePairs.vue";
import Settings from "./components/Settings.vue";
import { cfVerifyApiKey } from "./api/cloudflare.js";
import { storeToRefs } from 'pinia';
import { useSettingsStore } from './stores/settings-store.js';

const settingsStore = useSettingsStore();
const { cfAccountId, cfApiKey } = storeToRefs(settingsStore);

const showSettingsDialog = ref(false);

const isValidApiKey = ref(false);

const cfLogo = computed(() => new URL(`./assets/CF_logomark${isValidApiKey.value ? '' : '_black'}.svg`, import.meta.url).href);

onMounted(async () => isValidApiKey.value = await cfVerifyApiKey(cfApiKey.value));
watch(cfApiKey, async () => isValidApiKey.value = await cfVerifyApiKey(cfApiKey.value));

</script>

<template>
    <v-layout class="rounded rounded-md">
        <v-app-bar title="Cloudflare admin">
            <template v-slot:append>
                <v-btn @click="showSettingsDialog = true" 
                    :color="isValidApiKey ? 'orange' : 'red'"
                    :append-icon="isValidApiKey ? 'mdi-link' : 'mdi-link-off'">
                    <v-img :src="cfLogo" width="30" />
                </v-btn>
            </template>
        </v-app-bar>
        <v-main class="d-flex align-center justify-center" style="min-height: 300px;">
            <!-- Settings dialogs -->
            <v-dialog v-model="showSettingsDialog">
                <Settings @settings-saved="showSettingsDialog = false" />
            </v-dialog>

            <KeyValuePairs />
        </v-main>
    </v-layout>
</template>

<style scoped></style>
