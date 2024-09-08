<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "../stores/settings-store.js";
import cfClient from "../api/cloudflare.js";
import localforage from "localforage";

const settingsStore = useSettingsStore();
const {
    isValidApiKey,
    cfAccountId,
    cfApiKey,
    cfNamespaceId,
    cfNamespaceKeys,
    cfKeysCursor,
} = storeToRefs(settingsStore);

const cf = cfClient(cfApiKey.value, cfAccountId.value);

const clearDB = defineModel({ default: false });

const keyValuePairs = ref([]);
//--------------------------------------------------------------------------------
// Initialize localforage instance (IndexedDB)
const kvDB = localforage.createInstance({
    name: "cf-admin",
    storeName: "kv-pairs",
});

// Store key-value pairs in IndexedDB
const storeKeyValuePair = (key, value) => {
    keyValuePairs.value.push({ key: key.name, ...value });
    kvDB.setItem(key, value)
        .then(() => {})
        .catch((error) => console.error("[kvStore.setItem]", error));
};

watch(clearDB, () => clearKeyValuePairs());
const clearKeyValuePairs = () => {
    kvDB.clear()
        .then(() => {
            keyValuePairs.value = [];
            clearDB.value = false;
        })
        .catch((error) => console.error("[kvStore.clear]", error));
};

const loadingFromDB = ref(false);
// Load key-value pairs from IndexedDB
const loadKeyValuePairs = () => {
    console.time("loadKeyValuePairs()");
    loadingFromDB.value = true;
    let data = [];
    kvDB.iterate((value, key, iterationNumber) => {
        data.push(value);
    })
        .then(() => {
            keyValuePairs.value = data;
        })
        .catch((error) => {
            throw new Error(error);
        })
        .finally(() => {
            loadingFromDB.value = false;
            console.timeEnd("loadKeyValuePairs()");
        });
};

//--------------------------------------------------------------------------------
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
        kvPairs = kvPairs.concat({
            key: key.name,
            ...value,
        });
        storeKeyValuePair(key.name, value);
        keysProcessed.value++;
    } catch (error) {
        console.error(
            `[fetchKeyValue] - Error fetching value for key ${key.name} at position ${keysProcessed.value}`,
            error,
        );
        console.error(
            `[fetchKeyValue] - Fetched ${keysProcessed.value} (${keysToProcess.value}) keys`,
        );
    }
};

let kvPairs = [];
let keyQueue = [];
let keyQueueTimer;

// 1200 requests per 5 minutes => max 4 api calls per second => 250ms delay
const rateInterval = 300;

const keysToProcess = ref(0);
const keysProcessed = ref(0);
const loadingFromWeb = ref(false);
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

            let batchSize = Math.min(limit, keyQueue.length);

            // Remove the last batchSize elements from the end of the queue
            const batch = keyQueue.splice(-batchSize);
            // Map the batch to fetchFunction calls
            const promises = batch.map((param) => fetchKeyValue(param));

            try {
                await Promise.all(promises); // Wait for all promises in the current batch to resolve
                console.log(`[process] - Batch completed`);

                // Store first batch so key-value pair table gets updated
                if (limit > 1) keyValuePairs.value = kvPairs;
            } catch (error) {
                console.error("[process] - Error in batch processing", error);
            }
        } else {
            // console.log("[process] - Processing a single key");
            const key = keyQueue.pop();
            await fetchKeyValue(key);
            keysProcessed.value++;
            // cfKeyValuePairs.value = kvPairs;
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
            // loadingFromWeb.value = false;
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
};

// Start or stop key-queue processing
const handleKeyQueueProcessing = () => {
    if (loadingFromWeb.value || keyQueueTimer) {
        stopKeyQueueProcessing();
        loadingFromWeb.value = false;
    } else {
        loadingFromWeb.value = true;
        startKeyQueueProcessing().then(() => (loadingFromWeb.value = false));
    }
};

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
onMounted(async () => loadKeyValuePairs());

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
                variant="outlined"
                density="compact"
                :disabled="isValidApiKey == false"
                :loading="loadingNamespaces"
            >
            </v-select>

            <v-btn
                :icon="
                    loadingFromWeb ? 'mdi-cloud-cancel' : 'mdi-cloud-refresh'
                "
                variant="plain"
                class="ma-1"
                :color="loadingFromWeb ? 'orange darken-2' : ''"
                :loading="loadingFromWeb"
                @click="handleKeyQueueProcessing()"
            />
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
            :items="keyValuePairs"
            item-value="key"
            :loading="loadingFromDB"
            density="compact"
            fixed-header
            fixed-footer
            height="calc(100vh - 195px)"
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
                            <div class="text-caption text-center">
                                {{ keysProcessed }} ({{ keysToProcess }})
                            </div>
                        </template>
                    </v-progress-linear>
                </div>
            </template>
        </v-data-table-virtual>
    </v-card>
</template>
