<script setup>
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup
import { computed, onMounted, ref, watch } from 'vue';
import KeyValuePairs from "./components/KeyValuePairs.vue";
import Settings from "./components/Settings.vue";
import { cfVerifyApiKey } from "./api/cloudflare.js";
import { storeToRefs } from 'pinia';
import { useSettingsStore } from './stores/settings-store.js';
import { useTheme } from 'vuetify';

const settingsStore = useSettingsStore();
const { cfApiKey } = storeToRefs(settingsStore);

const theme = useTheme();

const isValidApiKey = ref(false);
const showSettingsDialog = ref(false);

const cfLogo = computed(() => new URL(`./assets/CF_logomark${isValidApiKey.value ? '' : (theme.global.current.value.dark ? '_white' : '_black')}.svg`, import.meta.url).href);
const toggleTheme = () => { theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'; }
onMounted(async () => { isValidApiKey.value = await cfVerifyApiKey(cfApiKey.value); });
watch(cfApiKey, async () => { isValidApiKey.value = await cfVerifyApiKey(cfApiKey.value); });

</script>

<template>
    <v-layout class="rounded rounded-md">
        <v-app-bar title="Cloudflare admin">
            <template v-slot:append>
                <v-btn @click="showSettingsDialog = true" color="orange darken-2" variant="plain"
                    :append-icon="isValidApiKey ? 'mdi-link' : 'mdi-link-off'">

                    <v-img :src="cfLogo" width="30" />
                </v-btn>

                <v-btn icon="mdi-theme-light-dark" @click="toggleTheme" variant="plain" />

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

    </v-layout>
</template>

<style scoped></style>
