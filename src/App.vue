<script setup>
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup
import { ref } from 'vue';
import KeyValuePairs from "./components/KeyValuePairs.vue";
import Settings from "./components/Settings.vue";

const showSettingsDialog = ref(false);

</script>

<template>
    <v-layout class="rounded rounded-md">
        <v-app-bar title="Cloudflare admin">
            <template v-slot:append>
                <v-btn icon="mdi-cog-outline" @click="showSettingsDialog=true"></v-btn>
            </template>
        </v-app-bar>
        <v-main class="d-flex align-center justify-center" style="min-height: 300px;">

            <!-- Settings dialogs -->
            <v-dialog v-model="showSettingsDialog">
                <Settings @settings-saved="showSettingsDialog = false"/>
            </v-dialog>

            <KeyValuePairs />
        </v-main>
    </v-layout>
</template>

<style scoped>
</style>
