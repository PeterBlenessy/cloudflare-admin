<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { fetch } from "@tauri-apps/plugin-http";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "../stores/settings-store.js";
import cfClient from "../api/cloudflare.js";

const settingsStore = useSettingsStore();
const {
    isValidApiKey,
    cfAccountId,
    cfApiKey,
    cfNamespaceId,
    cfKeyValuePairs,
    cfNamespaceKeys,
    cfKeysCursor,
} = storeToRefs(settingsStore);

const cf = cfClient(cfApiKey.value, cfAccountId.value);

// Fetch all keys from stored cursor
const fetchAllKeys = async () => {
    let allKeys = [];
    let limit = 1000;
    let cursor = cfKeysCursor.value || null;
    let fetchMore = true;
    let apiCallCount = 0;

    try {
        while (fetchMore) {
            const { keys, info } = await cf.listKeys(
                cfNamespaceId.value,
                limit,
                cursor,
            );

            apiCallCount++;
            allKeys = allKeys.concat(keys);
            cursor = info.cursor;

            console.log(
                `API calls: ${apiCallCount}. Fetched ${keys.length} keys. Total keys fetched: ${allKeys.length}`,
            );

            // Save cursor so we don't fetch all keys again
            if (cursor) cfKeysCursor.value = cursor;
            if (!cursor || info.count < limit) fetchMore = false;
        }
    } catch (error) {
        console.error("Error fetching keys:", error);
    }

    return { keys: allKeys, apiCalls: apiCallCount, cursor: cursor };
};

const fetchKeyValue = async (key) => {
    try {
        const value = await cf.readKeyValuePair(cfNamespaceId.value, key.name);
        cfKeyValuePairs.value = cfKeyValuePairs.value.concat({
            key: key.name,
            ...value,
        });

        keysProcessed.value++;
    } catch (error) {
        console.error(`Error fetching value for key: ${key.name}`, error);
        console.error(
            `Processed keys: ${keysProcessed.value} (${keysToProcess.value})`,
        );
    }
};

let keyQueue = [];
let keyQueueTimer = null;
const rateInterval = 250; // 1200 requests per 5 minutes => max 4 api calls per second => 250ms delay

const keysToProcess = ref(0);
const keysProcessed = ref(0);
const importProgress = computed(() =>
    keysToProcess.value == 0
        ? 0
        : (keysProcessed.value / keysToProcess.value) * 100,
);
const importMessage = ref("");

// Processes 'limit' keys from the key-queue, default is one key
const processKeyQueue = async (limit = 1) => {
    if (keyQueue.length > 0) {
        for (let i = 0; i < Math.min(limit, keyQueue.length); i++) {
            const key = keyQueue.pop();
            await fetchKeyValue(key);
        }
    } else {
        console.log("Key-queue: empty.");
        stopKeyQueueProcessing();
    }
};

const startKeyQueueProcessing = async () => {
    console.log("Key-queue: START");
    console.log(`Key-queue length:, ${keyQueue.length}`);
    if (keyQueue.length == 0) {
        console.log("Key-queue: fetching new keys");
        const { keys } = await fetchAllKeys();

        // Filter out new keys
        const newKeys = keys.filter(
            (key) =>
                !cfNamespaceKeys.value.some((item) => item.name === key.name),
        );

        console.log(`Fetched ${keys.length} keys. New keys: ${newKeys.length}`);

        // Initiate key queue
        keyQueue = [...keys];
        keysToProcess.value = keyQueue.length;
        keysProcessed.value = 0;

        // Fetch the latest 100 keys first
        console.log("Key-queue: processing first 100 keys");
        await processKeyQueue(100);
    }
    console.log("Key-queue: processing keys");
    console.log(`Key-queue: processing ${keyQueue.length} keys`);
    keyQueueTimer = setInterval(processKeyQueue, rateInterval);
};

const stopKeyQueueProcessing = () => {
    console.log("Key-queue: STOP");
    clearInterval(keyQueueTimer);
    keyQueueTimer = null;
};

// Start or stop key-queue processing
const handleKeyQueueProcessing = () => {
    if (keyQueueTimer) {
        stopKeyQueueProcessing();
    } else {
        startKeyQueueProcessing();
    }
};

const loading = ref(false);

// { key, timestamp, type, text, data }
const kvHeaders = ref([
    { title: "Timestamp", key: "timestamp", width: "180px" },
    { title: "Type", key: "type" },
    { title: "Text", key: "text", width: "210px" },
    { title: "Data", key: "data" },
]);

const search = ref("");

const loadingNamespaces = ref(false);
const namespaceOptions = ref([]);

const loadNamespaceOptions = async () => {
    if (isValidApiKey.value == false) return;

    loadingNamespaces.value = true;
    let result = await cf.listNamespaces();

    namespaceOptions.value = result.map((item) => ({
        title: item.title,
        value: item.id,
    }));
    loadingNamespaces.value = false;
};

onMounted(async () => await loadNamespaceOptions());

watch(isValidApiKey, async () => await loadNamespaceOptions());
watch(cfNamespaceId, async () => handleKeyQueueProcessing());

onUnmounted(() => clearInterval(keyQueueTimer));
</script>

<template>
    <v-card flat width="100%">
        <v-card-title class="d-flex flex-wrap">
            <v-select
                class="flex-1-0 ma-2"
                v-model="cfNamespaceId"
                :items="namespaceOptions"
                label="Select namespace"
                prepend-inner-icon="mdi-database"
                append-icon="mdi-cloud-sync"
                variant="outlined"
                density="compact"
                @click:append="handleKeyQueueProcessing()"
                :disabled="isValidApiKey == false"
                :loading="loadingNamespaces"
            >
            </v-select>

            <v-text-field
                class="ma-2"
                v-model="search"
                label="Search"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                single-line
                density="compact"
            >
            </v-text-field>
        </v-card-title>

        <v-divider />

        <v-data-table-virtual
            width="100%"
            :headers="kvHeaders"
            :items="cfKeyValuePairs"
            item-value="key"
            :loading="loading"
            density="compact"
            fixed-header
            fixed-footer
            height="calc(100vh - 200px)"
            :search="search"
            items-per-page="-1"
        >
            <template v-slot:no-data>
                <v-btn
                    color="orange-darken-2"
                    prepend-icon="mdi-cloud-sync"
                    text="Fetch KV pairs"
                    :disabled="isValidApiKey == false"
                    @click.stop="handleKeyQueueProcessing()"
                />
            </template>

            <template v-slot:bottom>
                <div class="text-center pa-2">
                    <v-progress-linear
                        v-if="importProgress > 0 && importProgress < 100"
                        v-model="importProgress"
                        color="orange-darken-2"
                        height="20"
                        rounded="0"
                    >
                        <template v-slot:default="{ value }">
                            <div class="text-subtitle-2 text-center">
                                {{ Math.ceil(value) }}%
                            </div>
                        </template>
                    </v-progress-linear>
                </div>
            </template>
        </v-data-table-virtual>
    </v-card>
</template>
