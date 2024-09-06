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

    try {
        while (fetchMore) {
            const { keys, info } = await cf.listKeys(
                cfNamespaceId.value,
                limit,
                cursor,
            );

            allKeys = allKeys.concat(keys);
            cursor = info.cursor;

            console.log(
                `[fetchAllKeys] - Fetched ${keys.length} keys. Total: ${allKeys.length}`,
            );

            // Save cursor so we don't fetch all keys again next time
            if (cursor) cfKeysCursor.value = cursor;
            if (!cursor || info.count < limit) fetchMore = false;
        }
    } catch (error) {
        console.error("[fetchAllKeys] - Error fetching keys:", error);
    }

    return { keys: allKeys, cursor: cursor };
};

const fetchKeyValue = async (key) => {
    try {
        const value = await cf.readKeyValuePair(cfNamespaceId.value, key.name);
        keyValuePairs = keyValuePairs.concat({
            key: key.name,
            ...value,
        });
    } catch (error) {
        console.error(
            `[fetchKeyValue] - Error fetching value for key: ${key.name}`,
            error,
        );
        console.error(
            `[fetchKeyValue] - Fetched ${keysProcessed.value} (${keysToProcess.value}) keys`,
        );
    }
};

let keyValuePairs = [];
let keyQueue = [];
let keyQueueTimer = null;

// 1200 requests per 5 minutes => max 4 api calls per second => 250ms delay
const rateInterval = 300;

const keysToProcess = ref(0);
const keysProcessed = ref(0);
const importProgress = computed(() =>
    keysToProcess.value == 0
        ? 0
        : (keysProcessed.value / keysToProcess.value) * 100,
);

// Processes 'limit' keys from the key-queue, default is one key
const processKeyQueue = async (limit = 1) => {
    if (keyQueue.length > 0) {
        if (limit > 1) {
            console.log(`[process] - Processing a batch of ${limit} keys`);
        }

        let batchSize = Math.min(limit, keyQueue.length);

        // Remove the last batchSize elements from the end of the queue
        const batch = keyQueue.splice(-batchSize);
        // Map the batch to fetchFunction calls
        const promises = batch.map((param) => fetchKeyValue(param));
        keysProcessed.value += batchSize;

        try {
            await Promise.all(promises); // Wait for all promises in the current batch to resolve
            console.log(`[process] - Batch completed`);

            // Store first batch so key-value pair table gets updated
            if (limit > 1) cfKeyValuePairs.value = keyValuePairs;
        } catch (error) {
            console.error("[process] - Error in batch processing", error);
        }
    } else {
        console.log("[process] - Key-queue is empty");
        stopKeyQueueProcessing();
    }
};

const startKeyQueueProcessing = async () => {
    console.log("[start] - Queue processing started");
    console.log(`[start] - Queue length:, ${keyQueue.length}`);
    if (keyQueue.length == 0) {
        console.log("[start] - Queue empty. Fetching (new) keys");
        const { keys } = await fetchAllKeys();

        // Filter out new keys
        const newKeys = keys.filter(
            (key) =>
                !cfNamespaceKeys.value.some((item) => item.name === key.name),
        );

        console.log(
            `[start] - Fetched ${keys.length} keys. New keys: ${newKeys.length}`,
        );

        if (newKeys.length == 0) {
            console.log("[start] - No new keys to process. Exiting.");
            return;
        }
        // Initiate key queue
        keyQueue = [...newKeys];
        // Store new keys
        cfNamespaceKeys.value = cfNamespaceKeys.value.concat(newKeys);
        keysToProcess.value = keyQueue.length;
        keysProcessed.value = 0;

        // Fetch the latest 100 keys first
        console.log("[start] - Processing first 100 keys");
        await processKeyQueue(100);
    }
    console.log("[start] - Processing keys");
    console.log(`[start] - Processing ${keyQueue.length} keys`);
    keyQueueTimer = setInterval(processKeyQueue, rateInterval);
};

const stopKeyQueueProcessing = () => {
    console.log("[stop] - Key-queue processing stopped");
    console.log(`[stop] - Keys left in queue: ${keyQueue.length}`);
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
                            <div class="text-overline text-center">
                                {{ keysProcessed }} ({{ keysToProcess }})
                            </div>
                        </template>
                    </v-progress-linear>
                </div>
            </template>
        </v-data-table-virtual>
    </v-card>
</template>
